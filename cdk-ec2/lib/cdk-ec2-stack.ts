import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';

export class CdkEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ✅ Use default VPC (same as RDS)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true });

    // ✅ Security Group
    const sg = new ec2.SecurityGroup(this, 'ProductOrderSG', {
      vpc,
      allowAllOutbound: true,
      description: 'Allow SSH, App (8080), and MySQL (3306) access',
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080), 'App Port');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306), 'MySQL Port');

    // ✅ IAM Role for EC2
    const role = new iam.Role(this, 'EC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // ✅ Reference existing RDS instance (not recreate)
    const dbInstance = rds.DatabaseInstance.fromDatabaseInstanceAttributes(this, 'ExistingRDS', {
      instanceEndpointAddress: 'productorder-db.cmnowosm8o07.us-east-1.rds.amazonaws.com',
      instanceIdentifier: 'productorder-db',
      port: 3306,
      securityGroups: [sg],
    });

    // ✅ EC2 instance to run Docker app
    const instance = new ec2.Instance(this, 'ProductOrderInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: sg,
      role,
      keyName: 'order-product-key', // Must exist in your region
    });

    // ✅ EC2 User Data (start Docker + run app)
    instance.addUserData(`
      #!/bin/bash
      yum update -y
      yum install -y docker
      service docker start
      usermod -a -G docker ec2-user

      docker run -d -p 8080:8080 \
        -e SPRING_DATASOURCE_URL=jdbc:mysql://productorder-db.cmnowosm8o07.us-east-1.rds.amazonaws.com:3306/product_order_db?useSSL=false\\&allowPublicKeyRetrieval=true\\&serverTimezone=UTC \
        -e SPRING_DATASOURCE_USERNAME=admin \
        -e SPRING_DATASOURCE_PASSWORD=Baraa@1234 \
        -e SPRING_DATASOURCE_DRIVER_CLASS_NAME=com.mysql.cj.jdbc.Driver \
        -e SPRING_JPA_HIBERNATE_DDL_AUTO=update \
        -e SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT=org.hibernate.dialect.MySQLDialect \
        baraalfares/product-order:latest
    `);

    // ✅ Outputs
    new cdk.CfnOutput(this, 'InstancePublicIP', {
      value: instance.instancePublicIp,
      description: 'Public IP of the EC2 instance',
    });

    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      description: 'RDS Endpoint (already exists)',
    });
  }
}
