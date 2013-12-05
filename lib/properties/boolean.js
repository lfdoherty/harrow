
exports.name = 'boolean'
exports.func = function(){
	return makeBool
}

function makeBool(rs){
	if(rs){
		return rs.readBoolean()
	}else{
		return false
	}
}

makeBool.serialize = function(v, w){
	w.putBoolean(!!v)
}

makeBool.isDefault = function(v){
	return !v
}

makeBool.getDefaultValue = function(){
	return false
}

makeBool.toJson = function(v, already){
	return v
}
