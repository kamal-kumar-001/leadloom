import {it,expect,vi} from 'vitest';
import {ProjectGrowthWatchWorker} from '../project-growth-watch.service';
it('one local loop starts once, never overlaps, and drains its in-flight tick before stopping',async()=>{
 vi.useFakeTimers();let finish:()=>void=()=>{};const service={tick:vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}))},worker=new ProjectGrowthWatchWorker(service as any,1000);
 try{
  worker.start();worker.start();expect(worker.available).toBe(true);expect(service.tick).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(5000);expect(service.tick).toHaveBeenCalledTimes(1);
  finish();await Promise.resolve();await Promise.resolve();await vi.advanceTimersByTimeAsync(1000);expect(service.tick).toHaveBeenCalledTimes(2);
  let stopped=false;const stop=worker.stop().then(()=>{stopped=true;});expect(worker.available).toBe(false);await Promise.resolve();expect(stopped).toBe(false);finish();await stop;expect(stopped).toBe(true);await vi.advanceTimersByTimeAsync(5000);expect(service.tick).toHaveBeenCalledTimes(2);
 }finally{finish();await worker.stop();vi.useRealTimers();}
});
