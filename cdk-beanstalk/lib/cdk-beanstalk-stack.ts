import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as elasticbeanstalk from "aws-cdk-lib/aws-elasticbeanstalk";
import * as s3assets from "aws-cdk-lib/aws-s3-assets";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmgr from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";

export class CdkBeanstalkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = "product-order-eb";
    const envName = "product-order-env";

    // VPC
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC },
        { name: "app", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: "db", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    const ebSG = new ec2.SecurityGroup(this, "EbSG", { vpc, allowAllOutbound: true });
    const dbSG = new ec2.SecurityGroup(this, "DbSG", { vpc, allowAllOutbound: true });
    dbSG.addIngressRule(ebSG, ec2.Port.tcp(3306), "Allow EB to DB");

    // Secret
    const dbSecret = new secretsmgr.Secret(this, "DbSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "appuser" }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
    });

    // RDS (use a version your region supports)
    const db = new rds.DatabaseInstance(this, "AppRds", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.of("8.4.6", "8.4"),
      }),
      vpc,
      vpcSubnets: { subnets: vpc.isolatedSubnets },
      securityGroups: [dbSG],
      credentials: rds.Credentials.fromSecret(dbSecret),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      publiclyAccessible: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      databaseName: "productorderdb",
    });

    // EB instance role
    const instanceRole = new iam.Role(this, "EbInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });
    instanceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AWSElasticBeanstalkWebTier"));
    instanceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));
    instanceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"));
    const instanceProfile = new iam.CfnInstanceProfile(this, "EbInstanceProfile", {
      roles: [instanceRole.roleName],
    });

    // EB application
    const app = new elasticbeanstalk.CfnApplication(this, "App", {
      applicationName: appName,
    });

    // Dockerrun asset (ZIP produced by CI in repo root)
    const dockerrunAsset = new s3assets.Asset(this, "DockerrunAsset", {
      // If your repo structure is:
      // / (root)
      //   dockerrun.zip     <-- CI creates this file here
      //   cdk-beanstalk/...
      // then path is "../dockerrun.zip" from the cdk-beanstalk dir
      path: "../dockerrun.zip",
    });

    // Unique construct id => new EB ApplicationVersion every deploy
    const stamp = `V${Date.now()}`; // must start with a letter
    const appVersion = new elasticbeanstalk.CfnApplicationVersion(this, `AppVersion${stamp}`, {
      applicationName: appName,
      sourceBundle: {
        s3Bucket: dockerrunAsset.s3BucketName,
        s3Key: dockerrunAsset.s3ObjectKey,
      },
      // description is optional; helps debugging
      description: `CI build ${stamp}`,
    });
    appVersion.addDependency(app);

    // EB environment using the generated versionLabel (appVersion.ref)
    const env = new elasticbeanstalk.CfnEnvironment(this, "Environment", {
      environmentName: envName,
      applicationName: appName,
      solutionStackName: "64bit Amazon Linux 2 v4.3.3 running Docker",
      versionLabel: appVersion.ref, // <-- THIS is the right way
      optionSettings: [
        { namespace: "aws:ec2:vpc", optionName: "VPCId", value: vpc.vpcId },
        { namespace: "aws:ec2:vpc", optionName: "Subnets", value: vpc.privateSubnets.map(s => s.subnetId).join(",") },
        { namespace: "aws:ec2:vpc", optionName: "ELBSubnets", value: vpc.publicSubnets.map(s => s.subnetId).join(",") },
        { namespace: "aws:autoscaling:launchconfiguration", optionName: "IamInstanceProfile", value: instanceProfile.ref },
        { namespace: "aws:autoscaling:launchconfiguration", optionName: "SecurityGroups", value: ebSG.securityGroupId },
        { namespace: "aws:autoscaling:launchconfiguration", optionName: "InstanceType", value: "t3.micro" },

        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DB_HOST", value: db.dbInstanceEndpointAddress },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DB_PORT", value: db.dbInstanceEndpointPort },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DB_NAME", value: "productorderdb" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DB_USER", value: dbSecret.secretValueFromJson("username").unsafeUnwrap() },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DB_PASS", value: dbSecret.secretValueFromJson("password").unsafeUnwrap() },
      ],
    });
    env.addDependency(appVersion);

    new cdk.CfnOutput(this, "EbUrl", { value: env.attrEndpointUrl });
    new cdk.CfnOutput(this, "DbEndpoint", { value: db.dbInstanceEndpointAddress });
  }
}
