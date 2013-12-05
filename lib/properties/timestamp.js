
exports.name = 'timestamp'
exports.func = function(){
	return makeTimestamp
}

function makeTimestamp(rs){
	if(rs){
		return rs.readLong()
	}else{
		return 0
	}
}

makeTimestamp.serialize = function(v,w){
	w.putLong(v)
}

makeTimestamp.isDefault = function(v){
	return v==undefined||v==0
}

makeTimestamp.getDefaultValue = function(){
	return undefined
}

makeTimestamp.toJson = function(v, already){
	return v
}
