#!/usr/bin/env bash

# test condition
root=`pwd`
nranks=10
msz_mbytes=$(( 30 ))
export msz_count=$(( 100 ))
export filename="${root}/message.bin"


mega=$(( 1024*1024 ))
msz_size=$(( ${msz_mbytes} * ${mega} ))

# run a web server
python3 ws_flask.py $msz_size $filename &
ws_pid=$!
while [ ! -f ${filename} ]
do
    echo "wait pseudo-message"
    sleep 10
done
echo "pseudo-message is ready!"
ls -al

# test (mpi)
start_time="$(date -u +%s.%N)"
mpirun -n $nranks ./send_message.sh
end_time="$(date -u +%s.%N)"

elapsed="$(bc -l <<<"$end_time-$start_time")"
throughput=$(bc -l <<<"${msz_mbytes}*${msz_count}/(${end_time}-${start_time})")
echo "============================================="
echo "# Ranks             : $nranks"
echo "Message size        : $msz_mbytes MBytes"
echo "# Message (per rank): $msz_count "
echo "Total elapsed time  : $elapsed sec"
echo "Throughput          : $throughput MBytes/sec"
echo "============================================="


kill -9 $ws_pid
rm -f ${filename}
