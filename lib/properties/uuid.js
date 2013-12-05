
exports.name = 'uuid'
exports.func = function(){
	return makeUuid
}

function makeUuid(rs){
	if(rs){
		return rs.readUuid()
	}else{
		return
	}
}

makeUuid.serialize = function(v, w){
	w.putUuid(v)
}

makeUuid.isDefault = function(v){
	return v==undefined
}

makeUuid.getDefaultValue = function(){
	return undefined
}

makeUuid.toJson = function(v, already){
	return v
}
