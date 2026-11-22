export interface ProjectInventory {
 project:{id:string;name:string;slug:string};asOf:string;
 tables:{counts:{tables:number;storedRows:number};latest:{id:string;name:string;storedRows:number;updatedAt:string}[]};
 assets:{counts:{kind:string;count:number}[];latest:{id:string;kind:string;version:number;title:string;updatedAt:string}[]};
 research:{counts:{kind:string;count:number}[]};
 validation:{counts:{experiments:number;published_pages:number;captured_leads:number};latest:{id:string;hypothesis:string;pageSlug:string|null;pageStatus:string|null;capturedLeads:number}[]};
 outreach:{campaignCounts:{status:string;count:number}[];jobCounts:{status:string;count:number}[];latest:{id:string;name:string;status:string}[]};
 records:{id:string;kind:string;title:string;createdAt:string}[];limits:string[];
}
