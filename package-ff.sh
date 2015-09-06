#!/bin/bash

# load common library functions
[ -r common.sh ] && source common.sh

echo "============================================"
echo "Packaging Grd Me for Firefox"
echo "============================================"

cd ./Firefox/dist
jpm xpi
mv $(ls | grep *.xpi) ../../grd_me.xpi
cd ../..
openssl sha1 grd_me.xpi

echo "============================================"
echo "Finished packaging Grd Me for Firefox"
echo "============================================"
exit 0
