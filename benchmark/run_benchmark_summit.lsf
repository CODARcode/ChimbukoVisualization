#!/bin/bash
# Begin LSF Directives
#BSUB -P CSC299
#BSUB -W 1:00
#BSUB -nnodes NNODES
#BSUB -J JOBNAME
#BSUB -o JOBNAME.o.%J
#BSUB -e JOBNAME.e.%J

module load gcc/8.1.1
module load curl/7.63.0
module load python/3.7.0-anaconda3-5.3.0

#set -x

root=`pwd`
mega=$(( 1024*1024  ))
msz_count=$(( 100  ))

for msz_mbytes in 1 2 4
do

  echo
  echo "========== NRANKS with ${msz_mbytes} MBytes =========="

  # prepare data and launch web server
  addr="http://`jsrun -n 1 hostname`:5000"
  msz_size=$(( ${msz_mbytes} * ${mega}  ))
  msz_fn="${root}/msg_NRANKS.bin"
  log_fn="${root}/msg_NRANKS.log"
  echo "web server @ ${addr}"
  jsrun -n 1 -a 1 -c 42 -g 0 -r 1 python3 ws_flask.py $addr $msz_size $msz_fn $log_fn &
  ws_pid=$!
  while [ ! -f ${msz_fn} ]
  do
    echo "wait pseudo-message"
    sleep 1
  done  
  echo "pseudo-message is ready!"

  # start sending pseudo-messages
  s_time="$(date -u +%s.%N)"
  jsrun -n NRS -a NMPI -c NCORES -g 0 -r 1 python3 send_message.py "${addr}/messages" $msz_fn $msz_count
  e_time="$(date -u +%s.%N)"
 
  # print out statistics
  total_ranks=$(( NRS * NMPI  ))
  elapsed="$(bc -l <<<"$e_time-$s_time")"
  out1=$(bc -l <<<"${msz_mbytes}*${msz_count}*${total_ranks}/(${e_time}-${s_time})")
  out2=$(bc -l <<<"${msz_count}*${total_ranks}/(${e_time}-${s_time})")
  echo 
  echo "# Ranks             : $total_ranks"
  echo "Message size        : $msz_mbytes MBytes"
  echo "# Message (per rank): $msz_count"
  echo "Elapsed time        : $elapsed sec"
  echo "Throughput          : $out1 MBytes/sec"
  echo "Throughput          : $out2 Messages/sec"
  echo 

  # clean for the next run
  jsrun -n 1 -c 1 curl --silent --output /dev/null -X POST "${addr}/shutdown"
  rm -f ${msz_fn} ${log_fn}
  wait $ws_pid
  echo "======================================================"
  echo

done

