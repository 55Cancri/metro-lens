# Local development
1. `cd` into client folder, then run `yarn start`.


# Deploy to production
1. Run `yarn deploy`.
2. If you are inside of either the client or cloud directory, that command will call the `deploy.sh` script at the root of the project.
3. The script then builds the code and runs the tests for both repos, and then finally, deploys the app from the cdk directory.

# Clone directory, ignoring node_modules
1. Run `python3 clone.py`. This will create a cloned repo with the name "[repo-name]-clone".

# Welcome to your CDK TypeScript project!

You should explore the contents of this project. It demonstrates a CDK app with an instance of a stack (`MetroLensStack`)
which contains an Amazon SQS queue that is subscribed to an Amazon SNS topic.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
