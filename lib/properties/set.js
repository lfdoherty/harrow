
exports.name = 'set'
exports.func = function(def, genCb){
	return makeSetGenerator(def, genCb)
}

function makeSetGenerator(def, genCb){
	//console.log('set def: ' + JSON.stringify(def))
	var makeMember = genCb(def.type.members)
	if(!makeMember.serialize) throw new Error('cannot serialize: ' + JSON.stringify(makeMember))
	function makeSet(rs, objMap){
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
	makeSet.memberFunc = makeMember.func
	makeSet.memberSerialize = makeMember.serialize
	
	
	makeSet.toJson = function(v, already){
		var arr = []
		if(v){
			for(var i=0;i<v.length;++i){
				arr[i] = makeMember.toJson(v[i], JSON.parse(JSON.stringify(already)))
			}
		}
		return arr
	}
	
	makeSet.serialize = function(v, w, makeCb){
		w.putInt(v.length)
		for(var i=0;i<v.length;++i){
			var m = v[i]
			if(!m){
				throw new Error('cannot serialize set member: ' + m)
			}
			//console.log(JSON.stringify(m))
			makeMember.serialize(m, w, makeCb)
		}
	}
	
	makeSet.isDefault = function(v){
		return v==undefined||v.length===0
	}

	makeSet.getDefaultValue = function(){
		return []
	}

	return makeSet
}

