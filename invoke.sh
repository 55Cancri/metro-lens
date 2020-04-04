# Run this file by calling the yarn invoke script in any child directory.
# e.g. yarn invoke scribe50AAC574


# define colors
green='\033[0;32m'  
red='\033[0;31m'
reset='\033[0m'

# define symbols
checkmark='\xE2\x9C\x93'
crossmark='\xE2\x9C\x97'

# define formatters
bold=$(tput bold)

# define lambda logical id
lambda=$1

# terminate program if a lambda name was not provided (the argument is empty)
if test -z "$lambda"
  then
    echo "${red}${bold}${crossmark} You must provide the logical ID of a lambda in the template.yaml.${reset}"
    exit 0
fi

# load zsh presets and aliases (e.g. cdk alias) without logging anything
source ~/.zshrc > /dev/null 2>&1


# get the location of this script
scriptDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# cd to the script directory and run commands from there
cd $scriptDir

# go into the cloud folder to synth the cdk
cd cloud

# save the generated cloudformation template to a file
cdk synth --no-staging > template.yaml

echo "\n${green}${bold}${checkmark} Generated template.yaml.${reset}\n"

# start the default docker if it is not already running
docker-machine start

echo "\n${green}${bold}${checkmark} Docker is running.${reset}\n"


# invoke the lambda using the logical id of the lambda in the template.yaml
sam local invoke $lambda --no-event

echo "\n${green}${bold}${checkmark} Finished invoking lambda $lambda.${reset}\n"