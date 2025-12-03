/**
 * @author shaozilee
 *
 * BMP format encoder,encode 24bit BMP
 * Not support quality compression
 *
 */

function BmpEncoder(imgData, bitDepth = 24){
	this.buffer = imgData.data;
	this.width = imgData.width;
	this.height = imgData.height;
	this.bitDepth = bitDepth;
	
	if (this.bitDepth === 1) {
		// 1-bit BMP calculations
		this.bitsPerRow = this.width;
		this.bytesPerRow = Math.ceil(this.bitsPerRow / 8);
		this.extraBytes = (4 - (this.bytesPerRow % 4)) % 4; // Row padding to 4-byte boundary
		this.paddedBytesPerRow = this.bytesPerRow + this.extraBytes;
		this.rgbSize = this.height * this.paddedBytesPerRow;
		this.paletteSize = 8; // 2 colors * 4 bytes each
		this.offset = 54 + this.paletteSize;
	} else {
		// 24-bit BMP calculations (original)
		this.extraBytes = this.width%4;
		this.rgbSize = this.height*(3*this.width+this.extraBytes);
		this.paletteSize = 0;
		this.offset = 54;
	}
	
	this.headerInfoSize = 40;

	this.data = [];
	/******************header***********************/
	this.flag = "BM";
	this.reserved = 0;
	this.fileSize = this.rgbSize+this.offset;
	this.planes = 1;
	this.bitPP = this.bitDepth;
	this.compress = 0;
	this.hr = 0;
	this.vr = 0;
	this.colors = this.bitDepth === 1 ? 2 : 0;
	this.importantColors = 0;
}

BmpEncoder.prototype.encode = function(bottomTop) {
	var tempBuffer = new Buffer(this.offset+this.rgbSize);
	this.pos = 0;
	tempBuffer.write(this.flag,this.pos,2);this.pos+=2;
	tempBuffer.writeUInt32LE(this.fileSize,this.pos);this.pos+=4;
	tempBuffer.writeUInt32LE(this.reserved,this.pos);this.pos+=4;
	tempBuffer.writeUInt32LE(this.offset,this.pos);this.pos+=4;

	tempBuffer.writeUInt32LE(this.headerInfoSize,this.pos);this.pos+=4;
	tempBuffer.writeUInt32LE(this.width,this.pos);this.pos+=4;
	tempBuffer.writeInt32LE(bottomTop ? this.height : - this.height,this.pos);this.pos+=4;
	tempBuffer.writeUInt16LE(this.planes,this.pos);this.pos+=2;
	tempBuffer.writeUInt16LE(this.bitPP,this.pos);this.pos+=2;
	tempBuffer.writeUInt32LE(this.compress,this.pos);this.pos+=4;
	tempBuffer.writeUInt32LE(this.rgbSize,this.pos);this.pos+=4;
	tempBuffer.writeUInt32LE(this.hr,this.pos);this.pos+=4;
	tempBuffer.writeUInt32LE(this.vr,this.pos);this.pos+=4;
	tempBuffer.writeUInt32LE(this.colors,this.pos);this.pos+=4;
	tempBuffer.writeUInt32LE(this.importantColors,this.pos);this.pos+=4;

	// Write color palette for 1-bit BMP
	if (this.bitDepth === 1) {
		// Color 0: Black (RGB 0,0,0)
		tempBuffer.writeUInt8(0, this.pos); this.pos++; // Blue
		tempBuffer.writeUInt8(0, this.pos); this.pos++; // Green  
		tempBuffer.writeUInt8(0, this.pos); this.pos++; // Red
		tempBuffer.writeUInt8(0, this.pos); this.pos++; // Reserved
		
		// Color 1: White (RGB 255,255,255)
		tempBuffer.writeUInt8(255, this.pos); this.pos++; // Blue
		tempBuffer.writeUInt8(255, this.pos); this.pos++; // Green
		tempBuffer.writeUInt8(255, this.pos); this.pos++; // Red
		tempBuffer.writeUInt8(0, this.pos); this.pos++; // Reserved
	}

	if (this.bitDepth === 1) {
		this.encode1Bit(tempBuffer, bottomTop);
	} else {
		this.encode24Bit(tempBuffer, bottomTop);
	}

	return tempBuffer;
};

BmpEncoder.prototype.encode1Bit = function(tempBuffer, bottomTop) {
	var i = 0;
	
	var yStart = bottomTop ? this.height - 1 : 0;
	var yEnd = bottomTop ? -1 : this.height;
	var yStep = bottomTop ? -1 : 1;
	
	for (var y = yStart; y !== yEnd; y += yStep) {
		var rowPos = this.pos + (bottomTop ? (this.height - 1 - y) : y) * this.paddedBytesPerRow;
		var bitIndex = 0;
		var currentByte = 0;
		
		for (var x = 0; x < this.width; x++) {
			var pixelIndex = (y * this.width + x) * 4;
			var alpha = this.buffer[pixelIndex + 3];
			var r = this.buffer[pixelIndex];
			var g = this.buffer[pixelIndex + 1]; 
			var b = this.buffer[pixelIndex + 2];
			
			// Determine if pixel should be black (0) or white (1)
			// Transparent or dark pixels = black (0), others = white (1)
			var bit = (alpha < 128 || (r + g + b) < 384) ? 0 : 1;
			
			currentByte |= (bit << (7 - bitIndex));
			bitIndex++;
			
			if (bitIndex === 8 || x === this.width - 1) {
				tempBuffer[rowPos + Math.floor(x / 8)] = currentByte;
				currentByte = 0;
				bitIndex = 0;
			}
		}
		
		// Fill padding bytes with 0
		for (var p = 0; p < this.extraBytes; p++) {
			tempBuffer[rowPos + this.bytesPerRow + p] = 0;
		}
	}
};

BmpEncoder.prototype.encode24Bit = function(tempBuffer, bottomTop) {
	var i=0;
	var rowBytes = 3*this.width+this.extraBytes;

	if(bottomTop){
		for (var y = this.height-1; y >=0; y--){
			for (var x = 0; x < this.width; x++){
				var p = this.pos+y*rowBytes+x*3;
				i++;//a
				tempBuffer[p]= this.buffer[i++];//b
				tempBuffer[p+1] = this.buffer[i++];//g
				tempBuffer[p+2]  = this.buffer[i++];//r
			}
			if(this.extraBytes>0){
				var fillOffset = this.pos+y*rowBytes+this.width*3;
				tempBuffer.fill(0,fillOffset,fillOffset+this.extraBytes);
			}
		}	

	}else{
		for (var y = 0; y <this.height; y++){
			for (var x = 0; x < this.width; x++){
				var p = this.pos+y*rowBytes+x*3;
				i++;//a
				tempBuffer[p]= this.buffer[i++];//b
				tempBuffer[p+1] = this.buffer[i++];//g
				tempBuffer[p+2]  = this.buffer[i++];//r
			}
			if(this.extraBytes>0){
				var fillOffset = this.pos+y*rowBytes+this.width*3;
				tempBuffer.fill(0,fillOffset,fillOffset+this.extraBytes);
			}
		}
	}
};

module.exports = function(imgData, bottomTop=false, bitDepth=24) {
	var encoder = new BmpEncoder(imgData, bitDepth);
	var data = encoder.encode(bottomTop);
	return {
	data: data,
	width: imgData.width,
	height: imgData.height
	};
};
