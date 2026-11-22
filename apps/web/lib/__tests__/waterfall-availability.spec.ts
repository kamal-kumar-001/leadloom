import {it,expect,vi} from 'vitest';
import {estimateWaterfallCost} from '../engine-client';
it('never returns a sample provider quote from the production-facing estimation helper',async()=>{
 const network=vi.fn();vi.stubGlobal('fetch',network);try{await expect(estimateWaterfallCost(20)).rejects.toMatchObject({statusCode:503,code:'WATERFALL_UNAVAILABLE'});expect(network).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}
});
