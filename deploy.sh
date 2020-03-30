# load zsh presents without logging anything
source ~/.zshrc > /dev/null 2>&1

# get the location of this script
scriptDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# go to the script directory and run commands from there
cd $scriptDir

# compile the stack
yarn --cwd cloud run build || exit 1

# log success
echo -e 'Finished compiling \033[32;1mCDK\033[0m files. No TypeScript errors found.\n'

# compile the lambda(s)
yarn --cwd cloud/lambda run build || exit 1

# log success
echo -e 'Finished compiling \033[32;1mlambda\033[0m files. No TypeScript errors found.\n'

# compile the ui
yarn --cwd client run build || exit 1

# log success
echo 'Finished compiling \033[32;1mUI\033[0m files. No TypeScript errors found.\n'

# test the stack
yarn --cwd cloud run test || exit 1

# test the ui
yarn --cwd client run test || exit 1

# deploy the stack
yarn --cwd cloud run cdk-deploy || exit 1
