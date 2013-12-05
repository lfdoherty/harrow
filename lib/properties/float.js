
exports.name = 'float'
exports.func = function(){
	return makeFloat
}

function makeFloat(rs){
	if(rs){
		return rs.readReal()
	}else{
		return 0
	}
}

makeFloat.serialize = function(v, w){
	w.putReal(v)
}

makeFloat.isDefault = function(v){
	return v==undefined||v==0
}

makeFloat.getDefaultValue = function(){
	return undefined
}

makeFloat.toJson = function(v, already){
	return v
}
