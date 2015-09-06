#!/bin/bash

# load common library functions
[ -r common.sh ] && source common.sh

echo "============================================"
echo "Testing Grd Me for Firefox"
echo "============================================"

cd ./Firefox/dist
jpm test
cd ../..

echo "============================================"
echo "Finished testing Grd Me for Firefox"
echo "============================================"
exit 0
