import aws_cdk as cdk
from aws_cdk import (
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_codepipeline as codepipeline,
    aws_route53 as route53,
    aws_route53_targets as targets,
    aws_certificatemanager as acm,
    aws_iam as iam,
    aws_ssm as ssm,
    aws_codebuild as codebuild,
    custom_resources,
    pipelines,
)
import constructs
import os


class CertificateStack(cdk.Stack):
    def __init__(self, scope: constructs.Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        zone = route53.HostedZone.from_lookup(
            self, "HostedZone", domain_name="ballsortsolver.click"
        )

        certificate = acm.Certificate(
            self,
            "Certificate",
            domain_name="ballsortsolver.click",
            subject_alternative_names=["www.ballsortsolver.click"],
            validation=acm.CertificateValidation.from_dns(zone),
        )

        ssm.StringParameter(
            self,
            "CertificateArnParameter",
            parameter_name="/ballsortsolver/certificate-arn",
            string_value=certificate.certificate_arn,
        )


class BallSortDeployment(cdk.Stack):
    def __init__(
        self,
        scope: constructs.Construct,
        construct_id: str,
        *,
        bucket_name: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        bucket = s3.Bucket.from_bucket_name(self, "WebappBucket", bucket_name)
        commit_id = os.environ.get("CODEBUILD_RESOLVED_SOURCE_VERSION", "main")

        # Route53 hosted zone lookup
        zone = route53.HostedZone.from_lookup(
            self, "Zone", domain_name="ballsortsolver.click"
        )

        # Lookup certificate ARN from us-east-1
        certificate_arn_lookup = custom_resources.AwsCustomResource(
            self,
            "CertificateArnLookup",
            on_update=custom_resources.AwsSdkCall(
                action="getParameter",
                service="SSM",
                region="us-east-1",
                parameters={"Name": "/ballsortsolver/certificate-arn"},
                physical_resource_id=custom_resources.PhysicalResourceId.of(
                    "/ballsortsolver/certificate-arn"
                ),
            ),
            install_latest_aws_sdk=False,
            policy=custom_resources.AwsCustomResourcePolicy.from_sdk_calls(
                resources=[
                    f"arn:{cdk.Aws.PARTITION}:ssm:us-east-1:{cdk.Aws.ACCOUNT_ID}:parameter/ballsortsolver/certificate-arn"
                ]
            ),
        )

        certificate = acm.Certificate.from_certificate_arn(
            self,
            "Certificate",
            certificate_arn_lookup.get_response_field("Parameter.Value"),
        )

        # Cache policy for assets (cache indefinitely)
        assets_cache_policy = cloudfront.CachePolicy(
            self,
            "AssetsCachePolicy",
            default_ttl=cdk.Duration.days(365),
            max_ttl=cdk.Duration.days(365),
        )

        # Cache policy for index.html (no caching)
        no_cache_policy = cloudfront.CachePolicy(
            self,
            "NoCachePolicy",
            default_ttl=cdk.Duration.seconds(0),
            max_ttl=cdk.Duration.seconds(0),
        )

        # CloudFront distribution with OAC
        distribution = cloudfront.Distribution(
            self,
            "WebappDistribution",
            domain_names=["ballsortsolver.click", "www.ballsortsolver.click"],
            certificate=certificate,
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(
                    bucket, origin_path=f"/{commit_id}"
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=no_cache_policy,
            ),
            additional_behaviors={
                "assets/*": cloudfront.BehaviorOptions(
                    origin=origins.S3BucketOrigin.with_origin_access_control(
                        bucket, origin_path=f"/{commit_id}"
                    ),
                    cache_policy=assets_cache_policy,
                )
            },
            default_root_object="index.html",
        )

        # Manual bucket policy for imported bucket with OAC
        bucket_policy = custom_resources.AwsCustomResource(
            self,
            "BucketPolicyUpdate",
            on_create=custom_resources.AwsSdkCall(
                action="putBucketPolicy",
                service="S3",
                parameters={
                    "Bucket": bucket_name,
                    "Policy": cdk.Fn.to_json_string(
                        {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Principal": {
                                        "Service": "cloudfront.amazonaws.com"
                                    },
                                    "Action": "s3:GetObject",
                                    "Resource": f"arn:aws:s3:::{bucket_name}/*",
                                    "Condition": {
                                        "StringEquals": {
                                            "AWS:SourceArn": f"arn:aws:cloudfront::{self.account}:distribution/{distribution.distribution_id}"
                                        }
                                    },
                                }
                            ],
                        }
                    ),
                },
                physical_resource_id=custom_resources.PhysicalResourceId.of(
                    f"{bucket_name}-policy"
                ),
            ),
            install_latest_aws_sdk=False,
            policy=custom_resources.AwsCustomResourcePolicy.from_sdk_calls(
                resources=[f"arn:aws:s3:::{bucket_name}"]
            ),
        )
        bucket_policy.node.add_dependency(distribution)

        # Route53 A records (aliases)
        route53.ARecord(
            self,
            "AliasRecord",
            zone=zone,
            target=route53.RecordTarget.from_alias(
                targets.CloudFrontTarget(distribution)
            ),
        )

        route53.ARecord(
            self,
            "WwwAliasRecord",
            zone=zone,
            record_name="www",
            target=route53.RecordTarget.from_alias(
                targets.CloudFrontTarget(distribution)
            ),
        )

        cdk.CfnOutput(self, "DistributionId", value=distribution.distribution_id)


class BallSortSolverPipeline(cdk.Stack):
    def __init__(
        self,
        scope: constructs.Construct,
        construct_id: str,
        env: cdk.Environment,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)

        bucket_name = "ballsortsolver.click"

        # S3 bucket for webapp hosting (private)
        bucket = s3.Bucket(
            self,
            "WebappBucket",
            bucket_name=bucket_name,
        )

        # Get CodeStar connection ARN from SSM
        connection_arn = ssm.StringParameter.from_string_parameter_name(
            self, "ConnectionArn", "/github_jnawk/arn"
        ).string_value

        source = pipelines.CodePipelineSource.connection(
            "jnawk/ball-sort-solver", "main", connection_arn=connection_arn
        )

        synth_step = pipelines.ShellStep(
            "Synth",
            input=source,
            commands=[
                "curl -LsSf https://astral.sh/uv/install.sh | sh",
                "export PATH=$HOME/.local/bin:$PATH",
                "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash",
                "export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && nvm install 24 && nvm use 24",
                "npm install -g aws-cdk",
                "cdk synth",
                "cd web && npm install && npm run build",
                f"aws s3 sync dist/ s3://{bucket_name}/$CODEBUILD_RESOLVED_SOURCE_VERSION/",
            ],
            env={"PYTHON_VERSION": "3.12"},
        )

        pipeline = pipelines.CodePipeline(
            self,
            "Pipeline",
            synth=synth_step,
            pipeline_type=codepipeline.PipelineType.V2,
            self_mutation=True,
            code_build_defaults=pipelines.CodeBuildOptions(
                build_environment=codebuild.BuildEnvironment(
                    build_image=codebuild.LinuxBuildImage.STANDARD_7_0,
                    compute_type=codebuild.ComputeType.SMALL,
                )
            ),
        )

        deploy_stage = cdk.Stage(self, "Deploy")
        main_stack = BallSortDeployment(
            deploy_stage,
            "BallSortDeployment",
            bucket_name=bucket_name,
            env=env,
        )

        # Certificate stack in us-east-1
        cert_stack = CertificateStack(
            deploy_stage,
            "BallSortSolverCertificate",
            env=cdk.Environment(account=self.account, region="us-east-1"),
        )

        main_stack.add_dependency(cert_stack)

        pipeline.add_stage(deploy_stage)

        # no more pipeline modifications after here
        pipeline.build_pipeline()

        bucket.grant_read_write(pipeline.synth_project.grant_principal)


app = cdk.App()


# Main pipeline in ap-southeast-2
BallSortSolverPipeline(
    app,
    "BallSortSolverPipeline",
    env=cdk.Environment(account="232271975773", region="ap-southeast-2"),
)

app.synth()
