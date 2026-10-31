import {Controller,Put,Get,Param,ParseUUIDPipe,Headers,Req,Res,PayloadTooLargeException,BadRequestException} from '@nestjs/common';
import {ApiBody,ApiConsumes,ApiHeader,ApiTags} from '@nestjs/swagger';
import type {IncomingMessage} from 'node:http';
import {MediaService} from '../application/media.service.js';
import {MAX_IMAGE_BYTES} from '../domain/media.js';
interface ImageResponse {setHeader(name:string,value:string):void;send(bytes:Buffer):void;}
@ApiTags('Media')
@Controller('v1')
export class MediaController {
  constructor(private service:MediaService){}
  @Put('dev/uploads/:assetId')
  @ApiConsumes('image/png','image/jpeg')
  @ApiBody({schema:{type:'string',format:'binary'}})
  @ApiHeader({name:'x-upload-token',required:true,description:'Development reservation capability; never a merchant identity.'})
  async upload(@Param('assetId',ParseUUIDPipe) id:string,@Headers('x-upload-token') token:string,@Req() request:IncomingMessage){
    const asset=await this.service.upload(id,typeof token==='string'?token:'');
    if(request.headers['content-type']!==asset.contentType)throw new BadRequestException('Content type does not match reservation.');
    const length=request.headers['content-length'];if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)!==asset.size))throw new BadRequestException('Content length does not match reservation.');
    request.setTimeout(15000,()=>request.destroy());
    const parts:Buffer[]=[];let size=0;
    for await(const chunk of request.iterator({destroyOnReturn:false})){
      if(!(chunk instanceof Uint8Array))throw new BadRequestException('Binary image body required.');
      size+=chunk.byteLength;if(size>MAX_IMAGE_BYTES||size>asset.size){request.resume();throw new PayloadTooLargeException();}parts.push(Buffer.from(chunk));
    }
    await this.service.put(asset,Buffer.concat(parts));return{status:'uploaded',assetId:id};
  }
  @Get('media/:assetId')
  async image(@Param('assetId',ParseUUIDPipe) id:string,@Res() response:ImageResponse){
    const{asset,bytes}=await this.service.publicRead(id);response.setHeader('Content-Type',asset.contentType);response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Cache-Control','public, max-age=60');response.send(Buffer.from(bytes));
  }
}
