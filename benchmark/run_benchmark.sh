#!/usr/bin/env bash

# test condition
#root=`pwd`
#nranks=10
#msz_mbytes=$(( 50 ))
#export msz_count=$(( 100 ))
#export filename="${root}/message.bin"

#export addr="http://`hostname`:5000"
export addr="http://127.0.0.1:5000"
echo "web server @ ${addr}"

mega=$(( 1024*1024 ))
msz_size=$(( ${msz_mbytes} * ${mega} ))

# run a web server
python3 ws_flask.py $addr $msz_size $filename &
ws_pid=$!
while [ ! -f ${filename} ]
do
    echo "wait pseudo-message"
    sleep 10
done
echo "pseudo-message is ready!"
#ls -al

sleep 1
# start send pseudo-messages
start_time="$(date -u +%s.%N)"
#mpirun -n $nranks ./send_message.sh
mpirun -n $nranks python3 send_message.py "${addr}/messages" $filename $msz_count
end_time="$(date -u +%s.%N)"

elapsed="$(bc -l <<<"$end_time-$start_time")"
throughput=$(bc -l <<<"${msz_mbytes}*${msz_count}*${nranks}/(${end_time}-${start_time})")
throughput2=$(bc -l <<<"${msz_count}*${nranks}/(${end_time}-${start_time})")
echo "================================================="
echo "From sender perspective ...."
echo "# Ranks             : $nranks"
echo "Message size        : $msz_mbytes MBytes"
echo "# Message (per rank): $msz_count "
echo "Total elapsed time  : $elapsed sec"
echo "Throughput          : $throughput MBytes/sec"
echo "Throughput          : $throughput2 Messages/sec"
echo "================================================="

# at this point all message was sent, shutdown web server
#curl -X POST http://127.0.0.1:5000/shutdown
curl -X POST "${addr}/shutdown"
echo

wait $ws_pid
#kill -9 $ws_pid
rm -f ${root}/log.txt ${filename}
