#!/usr/bin/env bash

export root=`pwd`
export mega=$(( 1024*1024 ))

# numbter of message per rank
export msz_count=$(( 100 ))

min_nranks=1
max_nranks=10

min_msz_mbytes=1
max_msz_mbytes=128

for (( r=$min_nranks; r<=$max_nranks; r*=2 ))
do
    for (( m=$min_msz_mbytes; m<=$max_msz_mbytes; m*=2 ))
    do
        export nranks=$r
        export msz_mbytes=$m
        export filename="${root}/message_${nranks}_${msz_mbytes}.bin"

        # run jobs
        echo "# Ranks: ${nranks}, Message size: ${msz_mbytes}, # Messages: ${msz_count}"
        ./run_benchmark.sh
        echo
    done
done
