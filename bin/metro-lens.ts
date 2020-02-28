#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { MetroLensStack } from '../lib/metro-lens-stack';

const app = new cdk.App();
new MetroLensStack(app, 'MetroLensStack');
