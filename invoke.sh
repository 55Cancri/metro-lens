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
lambda=''
# lambda=$1


# this gibberish parses arguments
while [[ "$#" -gt 0 ]]; do case $1 in
  -s|--scribe) lambda=scribe50AAC574; shift;;
  -a|--auditor) lambda=auditorFB7F488D;;
  *) echo "Unknown parameter passed: $1"; exit 1;;
esac; shift; done

# terminate program if a lambda name was not provided (the argument is empty)
if test -z "$lambda"
  then
    echo "${red}${bold}${crossmark} You must provide the logical ID of a lambda in the template.yaml.${reset}"
    exit 0
fi

# load zsh presets and aliases (e.g. cdk alias) without logging anything
source ~/.zshrc > /dev/null 2>&1
# source ~/.bashrc > /dev/null 2>&1


# get the location of this script (without logging stdout or stderr)
scriptDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# cd to the script directory and run commands from there
cd $scriptDir

# go into the cloud folder to synth the cdk
cd cloud

# save the generated cloudformation template to a file
cdk synth --no-staging > template.yaml
# cdk synth --no-staging 2>&1 | tee template.yaml
echo "\n\n\n${green}${bold}${checkmark} Generated template.yaml.${reset}\n\n\n\n"

sleep 1

# start the default docker if it is not already running (without logging stdout)
docker-machine start > /dev/null
echo -e  "\r\033[6A\033[0K${green}${bold}${checkmark} Docker is running.${reset}\n\n"


sleep 1

# from the message:
# Started machines may have new IP addresses.
# You may need to re-run the `docker-machine env` command. (without logging stdout)
docker-machine env default > /dev/null
echo -e  "\r\033[3A\033[0K${green}${bold}${checkmark} Captured docker IP address.${reset}\n\n"

sleep 1

# configure docker to work with my shell (without logging stdout)
eval $(docker-machine env default) > /dev/null
echo -e  "\r\033[3A\033[0K${green}${bold}${checkmark} Configured docker to shell.${reset}\n\n"

sleep 1

# invoke the lambda using the logical id of the lambda in the template.yaml
# Some notes:
# - Using --profile default communicates with dynamodb directly.
#   No need to setup a docker dynamodb that needs to be populated with data.
# - The env.json MUST be in the same directory that this file is currently in when it
#   runs this command. A few commands up, this script cds into 'cloud'. So when it runs
#   sam local invoke, this file needs to be there. If it is at root level where the script
#   itself is, or nested deeper in the lambda folder, the command will fail silently.
#   You will see: Usage: sam local invoke [OPTIONS] [FUNCTION_IDENTIFIER].
sam local invoke $lambda --env-vars .env.json --no-event --profile default
echo -e "\r\033[1A\033[0K${green}${bold}${checkmark} Finished invoking lambda $lambda.${reset}"