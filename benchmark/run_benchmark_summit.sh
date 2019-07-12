#!/usr/bin/env bash

#set -x

# test condition
root=`pwd`
nranks=40
nsets=2
msz_mbytes=$(( 1 ))
export msz_count=$(( 50 ))
export filename="${root}/message.bin"

#export addr="http://`hostname`:5000"
export addr="http://`jsrun -n 1 hostname`:5000"
#export addr="http://127.0.0.1:5000"
echo "web server @ ${addr}"

mega=$(( 1024*1024 ))
msz_size=$(( ${msz_mbytes} * ${mega} ))

# run a web server
jsrun -n 1 -a 1 -c 42 -g 0 -r 1 python3 ws_flask.py $addr $msz_size $filename &
ws_pid=$!
while [ ! -f ${filename} ]
do
    echo "wait pseudo-message"
    sleep 10
done
echo "pseudo-message is ready!"
ls -al

# start send pseudo-messages
start_time="$(date -u +%s.%N)"
#jsrun -n $nranks -c 1 ./send_message.sh
jsrun -n $nsets -a $nranks -c $nranks -g 0 -r 1 python3 send_message.py "${addr}/messages" $filename $msz_count
end_time="$(date -u +%s.%N)"

total_ranks=$(( ${nranks}*${nsets}  ))
elapsed="$(bc -l <<<"$end_time-$start_time")"
throughput=$(bc -l <<<"${msz_mbytes}*${msz_count}*${total_ranks}/(${end_time}-${start_time})")
throughput2=$(bc -l <<<"${msz_count}*${total_ranks}/(${end_time}-${start_time})")
total_ranks=$(( ${nranks}*${nsets}  ))
echo "================================================="
echo "From sender perspective ...."
echo "# Ranks             : $total_ranks"
echo "Message size        : $msz_mbytes MBytes"
echo "# Message (per rank): $msz_count "
echo "Total elapsed time  : $elapsed sec"
echo "Throughput          : $throughput MBytes/sec"
echo "Throughput          : $throughput2 Messages/sec"
echo "================================================="
echo

# at this point all message was sent, shutdown web server
echo
jsrun -n 1 -c 1 curl -X POST "${addr}/shutdown"
echo

#jslist -R

wait $ws_pid
#kill -9 $ws_pid
rm -f ${filename} log.txt
