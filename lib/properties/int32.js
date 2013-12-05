
exports.name = 'int32'
exports.func = function(){
	return makeInt32
}

function makeInt32(rs){
	if(rs){
		return rs.readInt()
	}else{
		return 0
	}
}

makeInt32.serialize = function(v, w){
	w.putInt(v)
}

makeInt32.isDefault = function(v){
	return v==undefined||v==0
}

makeInt32.getDefaultValue = function(){
	return undefined
}

makeInt32.toJson = function(v, already){
	return v
}
