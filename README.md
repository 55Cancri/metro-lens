# Checklist if many months have passed

1. Ensure all email subscriptions are confirmed in the SNS console so that you can receive error emails.
2. Get a new API key from appsync as they expire after 7 days and paste it in the `.env` file for local, `staging/.env` for the lambdas (?), and the `credentials.ts` file for the UI.

# Local development

1. `cd` into client folder, then run `yarn start`.

# Update api key

1. In the appsync wizard, create a new key in the settings.
2. Copy the API key and paste in `client/src/credentials.ts` and `cloud/staging/.env.atlantic`. Then in cloud/.env, update the `GRAPHQL_ENDPOINT` and the `GRAPHQL_API_KEY`.

# Update components when graphql schema changes

1. `cd` into the `/cloud` directory and run `yarn watch`.
2. This command will look for changes in both the server graphql schema and the schemas used by React and generate or update new React components.

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

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template
