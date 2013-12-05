
exports.name = 'string'
exports.func = function(){
	return makeString
}

function makeString(rs){
	if(rs){
		return rs.readVarString()
	}else{
		return ''
	}
}

makeString.serialize = function(v,w){
	w.putString(v)
}

makeString.isDefault = function(v){
	return v==undefined||v==''
}

makeString.getDefaultValue = function(){
	return ''
}

makeString.toJson = function(v, already){
	return v
}
