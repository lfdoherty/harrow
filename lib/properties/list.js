
exports.name = 'list'
exports.func = function(def, genCb){
	return makeListGenerator(def, genCb)
}

function makeListGenerator(def, genCb){
	var makeMember = genCb(def.type.members)
	if(!makeMember.serialize){
		throw new Error('cannot _serialize: ' + JSON.stringify(makeMember))
	}
	function makeList(rs, objMap, context){
		if(rs){
			var many = rs.readInt()
			var arr = []
			for(var i=0;i<many;++i){
				var v = makeMember.func(rs, objMap)
				arr.push(v)
				if(def.type.members.inner){
					v.__belongsTo = context
					v.__belongsToBy = def.name
				}
			}
			return arr
		}else{
			return []
		}
	}

	makeList.toJson = function(v, already){
		var arr = []
		if(v){
			for(var i=0;i<v.length;++i){
				arr[i] = makeMember.toJson(v[i], JSON.parse(JSON.stringify(already)))
			}
		}
		return arr
	}
	
	makeList.serialize = function(v, w, makeCb){
		w.putInt(v.length)
		for(var i=0;i<v.length;++i){
			var m = v[i]
			makeMember.serialize(m, w, makeCb)
		}
	}
	
	makeList.memberFunc = makeMember.func
	makeList.memberSerialize = makeMember.serialize
	makeList.membersAreObjects = makeMember.isObject
	
	makeList.isDefault = function(v){
		return v==undefined||v.length===0
	}
	makeList.getDefaultValue = function(){
		return []
	}
	
	return makeList
}
