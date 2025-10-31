import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as elasticbeanstalk from "aws-cdk-lib/aws-elasticbeanstalk";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmgr from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";

export class CdkBeanstalkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = "product-order-eb";
    const envName = "product-order-env";

    /* Default VPC */
    const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", { isDefault: true });

    /* SG */
    const ebSG = new ec2.SecurityGroup(this, "EbSG", { vpc });
    const dbSG = new ec2.SecurityGroup(this, "DbSG", { vpc });

    dbSG.addIngressRule(
        ebSG,
        ec2.Port.tcp(3306),
        "Allow_EB_to_RDS"
    );

    /* Secret */
    const dbSecret = new secretsmgr.Secret(this, "DbSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "appuser" }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
    });

    /* RDS */
    const db = new rds.DatabaseInstance(this, "AppRds", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.of("8.0.37", "8.0"),
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSG],
      credentials: rds.Credentials.fromSecret(dbSecret),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      deletionProtection: false,
      publiclyAccessible: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      databaseName: "productorderdb",
    });

    /* EB Application */
    new elasticbeanstalk.CfnApplication(this, "EbApp", {
      applicationName: appName,
    });

    /* Instance role */
    const role = new iam.Role(this, "EbEC2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSElasticBeanstalkWebTier")
    );

    const instanceProfile = new iam.CfnInstanceProfile(
        this,
        "EbInstanceProfile",
        {
          roles: [role.roleName],
        }
    );

    /* ✅ EB Environment (NO versionLabel) */
    new elasticbeanstalk.CfnEnvironment(this, "EbEnv", {
      applicationName: appName,
      environmentName: envName,
      solutionStackName: "64bit Amazon Linux 2023 v4.7.0 running Corretto 17",

      optionSettings: [
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "IamInstanceProfile",
          value: instanceProfile.ref,
        },
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "SecurityGroups",
          value: ebSG.securityGroupId,
        },
        {
          namespace: "aws:autoscaling:launchconfiguration",
          optionName: "InstanceType",
          value: "t3.micro",
        },

        /* DB ENVs */
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_HOST",
          value: db.dbInstanceEndpointAddress,
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_PORT",
          value: db.dbInstanceEndpointPort,
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_NAME",
          value: "productorderdb",
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_USER",
          value: dbSecret.secretValueFromJson("username").unsafeUnwrap(),
        },
        {
          namespace: "aws:elasticbeanstalk:application:environment",
          optionName: "DB_PASS",
          value: dbSecret.secretValueFromJson("password").unsafeUnwrap(),
        },
      ],
    });

    /* Outputs */
    new cdk.CfnOutput(this, "RDS_ENDPOINT", {
      value: db.dbInstanceEndpointAddress,
    });
  }
}
