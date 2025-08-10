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
    pipelines,
)
import constructs
import os


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

        # ACM certificate for custom domain
        certificate = acm.Certificate(
            self,
            "Certificate",
            domain_name="ballsortsolver.click",
            subject_alternative_names=["www.ballsortsolver.click"],
            validation=acm.CertificateValidation.from_dns(zone),
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

        # CloudFront distribution
        distribution = cloudfront.Distribution(
            self,
            "WebappDistribution",
            domain_names=["ballsortsolver.click", "www.ballsortsolver.click"],
            certificate=certificate,
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin(bucket, origin_path=f"/{commit_id}"),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=no_cache_policy,
            ),
            additional_behaviors={
                "assets/*": cloudfront.BehaviorOptions(
                    origin=origins.S3BucketOrigin(bucket, origin_path=f"/{commit_id}"),
                    cache_policy=assets_cache_policy,
                )
            },
            default_root_object="index.html",
        )

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

        # S3 bucket for webapp hosting
        bucket = s3.Bucket(
            self,
            "WebappBucket",
            bucket_name=bucket_name,
            public_read_access=True,
            website_index_document="index.html",
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=False,
                block_public_policy=False,
                ignore_public_acls=False,
                restrict_public_buckets=False,
            ),
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
        BallSortDeployment(
            deploy_stage,
            "BallSortDeployment",
            bucket_name=bucket_name,
            env=env,
        )
        pipeline.add_stage(deploy_stage)

        # no more pipeline modifications after here
        pipeline.build_pipeline()

        # Grant S3 permissions to synth step
        pipeline.synth_project.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "s3:PutObject",
                    "s3:PutObjectAcl",
                    "s3:ListObjectsV2",
                    "s3:ListBucket",
                ],
                resources=[f"{bucket.bucket_arn}/*", bucket.bucket_arn],
            )
        )


app = cdk.App()
BallSortSolverPipeline(
    app,
    "BallSortSolverPipeline",
    env=cdk.Environment(account="232271975773", region="ap-southeast-2"),
)
app.synth()
