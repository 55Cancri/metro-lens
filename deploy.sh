# load zsh presets and aliases without logging anything
source ~/.zshrc > /dev/null 2>&1

# get the location of this script
scriptDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# go to the script directory and run commands from there
cd $scriptDir

# variable to control if unit tests should be run
run_unit_tests=

# look for the "--direct" "-d" flag in the arguments
while [[ "$#" -gt 0 ]]; do case $1 in
  -d|--direct) run_unit_tests='1'; shift;;
  *) echo "Unknown parameter passed: $1"; exit 1;;
esac; shift; done

# define hex emojis
rocket='\xf0\x9f\x9a\x80'
beach='\xf0\x9f\x8f\x96'

# define a function to build the cloud directory
build_cloud () {
  # compile the stack
  yarn --cwd cloud run build || exit 1

  # log success
  echo -e 'Finished compiling \033[32;1mCDK\033[0m files. No TypeScript errors found.\n'
}

# define a function to build the lambda directory
build_lambdas () {
  # compile the lambda(s)
  yarn --cwd cloud/lambda run build || exit 1
  
  # log success
  echo -e 'Finished compiling \033[32;1mlambda\033[0m files. No TypeScript errors found.\n'
}

# define a function to build the ui directory
build_ui () {
  # compile the ui
  yarn --cwd client run build || exit 1

  # log success
  echo 'Finished compiling \033[32;1mUI\033[0m files. No TypeScript errors found.\n'
}

# define a function to run the cloud tests
run_cloud_tests () {
  # test the stack
  yarn --cwd cloud run test || exit 1
}

# define a function to run the client tests
run_ui_tests () {
  # test the ui
  yarn --cwd client run test || exit 1
}

# define a function to run the unit tests
run_tests () {
  # -z = true if the length of the variable string is 0
  if test -z "$run_unit_tests"
    then
      # run the unit tests in parallel
      run_cloud_tests & run_ui_tests

      # wait for them to finish
      wait

    else
      # notify of skipped unit tests
      echo -e "\n\033[37;1mSkipping unit tests\033[0m $beach \n"
  fi 
}

# run the builds and unit tests in parallel (keeping the logs sequential)
build_cloud & build_lambdas & build_ui & run_tests

# wait for all background processes to finish before deploying or ending the program
wait

echo -e "\033[37;1mNow deploying stack\033[0m $rocket \n"

# deploy the stack
yarn --cwd cloud run cdk-deploy || exit 1
