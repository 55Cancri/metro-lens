# load zsh presents without logging anything
source ~/.zshrc > /dev/null 2>&1

# compile the app and ui typescript
yarn run build || exit 1
yarn --cwd client run build || exit 1

# test the app and ui typescript
yarn run test || exit 1
yarn --cwd client run test || exit 1

# deploy the stack
yarn run cdk-deploy || exit 1