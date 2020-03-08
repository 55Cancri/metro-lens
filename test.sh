# load zsh presents without logging anything
source ~/.zshrc > /dev/null 2>&1

# get the location of this script
scriptDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# go to the script directory and run commands from there
cd $scriptDir

# test the stack
yarn --cwd cloud run test || exit 1

# test the ui
yarn --cwd client run test || exit 1