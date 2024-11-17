document.addEventListener('DOMContentLoaded', exec);
window.addEventListener("popstate", exec);

let groupsLoaded = false;
function loadGroups() {
	if (groupsLoaded == false) {
		doGetJSON(`/api/groups`, parseGroups);
		groupsLoaded = true;
	}
}

function parseGroups(data) {
	let itemdiv = document.getElementById('items');
	addGroups(itemdiv, data, 0);
	if (localStorage) {
		localStorage.setItem("groups", itemdiv.innerHTML);
	}
}

function addGroups(parent, data, depth) {
	let keys = Object.keys(data).sort();
	for (let key of keys) {
		let group = data[key];
		let div = createElement('div', key, {'aria-expanded': 'false'});
		div.setAttribute('market_id', group.id);
		div.classList.add('depth' + depth);
		if (depth > 0) {
			div.classList.add('d-none');
			div.classList.add('parent_market_id', parent.getAttribute('market_id'));
		}

		parent.appendChild(div);
		div.onclick = toggleChildren;

		setTimeout(function() { addGroups(div, group.subgroups, depth + 1) }, 1);
		if (Object.keys(group.items).length > 0) {
			let ul = createElement('ul');
			ul.classList.add('d-none');
			for (let itemName of Object.keys(group.items).sort()) {
				let item = group.items[itemName];
				let li = createElement('li');
				let anchor = createElement('a', item.name, {item_id: item.item_id, href: '/item/' + item.item_id});
				anchor.onclick = litem;
				li.appendChild(anchor);
				ul.appendChild(li);
			}
			div.appendChild(ul);
		}
	}
}

function litem(e) {
	e.stopPropagation();
	let url = '/item/' + this.getAttribute('item_id');
	window.history.pushState({path: url},'', url);
	setTimeout(exec, 1);
	return false;
}

function toggleChildren(e) {
	e.stopPropagation();
	let market_id = this.getAttribute('market_id');
	console.log(market_id)
	let show = (this.getAttribute('aria-expanded') == "true" ? false : true);
	for (let child of this.children) {
		if (show) child.classList.remove('d-none');
		else child.classList.add('d-none');
	}
	this.setAttribute('aria-expanded', show);
	return false;
}

function exec() {
	const path = window.location.pathname;
	const split = path.split('/');
	
	switch(split[1]) {
	case 'item':
		loadItem(split[2]);
		break;
	default:
		console.log('unknown path execution');
	}
}

function loadItem(item_id) {
	doGetJSON(`/api/orders/${item_id}`, showItem);
}

function showItem(data) {
	document.getElementById('itemname').innerHTML = data.name;
	assembleColumns('buyorders', data.buy);
	assembleColumns('sellorders', data.sell);
	setTimeout(doFormats, 1);

	let now = Date.now();
	let then = now - (now % 900) + 900;
	setTimeout(exec, (then - now) * 1000);
}

const THEAD = `
<thead>
	<tr>
		<th>Location</th>
		<th class='text-end'>Price</th>
		<th class='text-end'>Remaining</th>
		<th class='text-end'>Range</th>
	</tr>
</thead>`;
const columns = {
	'location_name': {location: true},
	'price': {classes: 'format_dec text-end'},
	'volume_remain': {classes: 'format_int text-end'},
	'range': {classes: 'text-end capitalize'},
};
function assembleColumns(id, orders) {
	let table = createElement('table', undefined, {classes: 'table table-sm table-striped'});
	table.appendChild(createElement('thead', THEAD, undefined, undefined));
	let tablebody = createElement('tbody');
	table.appendChild(tablebody);

	for (let order of orders) {
		let tr = createElement('tr');
		for (let column of Object.keys(columns)) tr.appendChild(createElement('td', order[column], columns[column]));
		tablebody.append(tr);
	}

	let div = document.getElementById(id);
	div.innerHTML = '';
	div.appendChild(table);
}

function createElement(element, content = '', attributes = {}) {
	let e = document.createElement(element);
	for (let attr of Object.keys(attributes)) e.setAttribute((attr == 'classes' ? 'class' : attr), attributes[attr]);
	if (content) e.innerHTML = content;
	return e;
}

function doGetJSON(path, f) {
	const xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {if (xhr.readyState === 4) f(JSON.parse(xhr.responseText));};
	xhr.open('GET', path);
	xhr.send();
}

const formats = {
	'format_int': {dec: 0}, 
	'format_dec': {dec: 2}
}
function doFormats() {
	let completed = true;
	for (let format of Object.keys(formats)) {
		let elements = document.getElementsByClassName(format);
		for (let element of elements) {
			let t = element.innerHTML;
			let n = t.length > 10 ? BigInt(t) : Number(t);			
			element.innerHTML = n.toLocaleString(undefined, {minimumFractionDigits: formats[format].dec, maximumFractionDigits: formats[format].dec});
			element.classList.remove(format);
			completed = false;
		}
	}
	if (!completed) setTimeout(doFormats, 1);
	else setTimeout(loadGroups, 1);
}
