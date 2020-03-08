# import modules
import shutil
import os

# declare the ignore function

dir = os.path.basename(os.getcwd())

def ignoreFunc(file):
    def _ignore_(path, names):

        # list containing names of file that are needed to ignore
        ignored = ["node_modules"]

        # check if the file is in the names array,
        if file in names:
          
            # then add it to list
            ignored.append(file)

        # finally, return a set of the file names
        return set(ignored)

    return _ignore_


# source path e.g. /Users/emorrison/Documents/code/personal/test/grandcentral
src = os.getcwd()

# define the directory name
directory_name = "/" + dir + '-clone'

# destination path
dest = src + directory_name

# copy the contents from source to destination
# without some specified files or directories
shutil.copytree(src, dest, ignore=ignoreFunc('a'))

# notify on completion
print("Finished copying files to " + directory_name + " directory.")