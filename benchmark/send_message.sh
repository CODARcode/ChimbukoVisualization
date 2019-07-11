#!/usr/bin/env bash

counter=1
while [ $counter -le ${msz_count} ]
do
curl --silent --output /dev/null -H "Content-type: application/octet-stream" -X POST http://127.0.0.1:5000/messages --data-binary @${filename}
((counter++))
done