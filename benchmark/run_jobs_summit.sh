#!/usr/bin/env bash

# working directory (source code should placed here, for now)
#export root=`pwd`
# mega byte (constant)
#export mega=$(( 1024*1024 ))
# numbter of message per rank (constant)
#export msz_count=$(( 100 ))

# loop over various # MPI processors
for nranks in 400 800 1600 3200
do
   # on each summit node, we will run 40 MPI processors
   # and each processor is running on a core.
   # finally, add 1 node for the web server
   nmpi=40
   ncores=40   
   nrs=$(( $nranks/$nmpi ))
   nnodes=$(( $nrs + 1  ))

   lsf="run_benchmark_summit_${nranks}.lsf"
   jobname="ws-test-${nranks}"
   cp run_benchmark_summit.lsf $lsf
   sed -i "s|NNODES|$nnodes|g" "$lsf"
   sed -i "s|JOBNAME|$jobname|g" "$lsf"
   sed -i "s|NRANKS|$nranks|g" "$lsf"
   sed -i "s|NRS|$nrs|g" "$lsf"
   sed -i "s|NMPI|$nmpi|g" "$lsf"
   sed -i "s|NCORES|$ncores|g" "$lsf"
  
   # summit the job
   bsub $lsf
   echo "bsub $lsf"
   sleep 1
done
