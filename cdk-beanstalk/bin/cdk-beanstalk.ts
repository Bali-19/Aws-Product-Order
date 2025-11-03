#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkBeanstalkStack } from '../lib/cdk-beanstalk-stack';

const app = new cdk.App();
new CdkBeanstalkStack(app, "CdkBeanstalkStack", {});