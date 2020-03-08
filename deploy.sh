# load zsh presents without logging anything
source ~/.zshrc > /dev/null 2>&1

# compile the app and ui typescript
yarn --cwd cloud run build || exit 1
yarn --cwd client run build || exit 1

# test the app and ui typescript
yarn --cwd cloud run test || exit 1
yarn --cwd client run test || exit 1

# deploy the stack
yarn --cwd cloud run cdk-deploy || exit 1