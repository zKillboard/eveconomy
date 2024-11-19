window.addEventListener("popstate", exec);
document.addEventListener('DOMContentLoaded', exec);
document.getElementById('searchbox').addEventListener('input', doSearch);

const searcharray = {};

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

		let div = createElement('div', undefined, {classes: 'mlist'})
		let anchor = createElement('a', key, {classes: 'btn btn-sm btn-default groupname', 'data-bs-toggle': 'collapse', href: '#subgroup' + group.id, role: 'button', 'aria-expanded': false});
		let subgroup = createElement('div', undefined, {id: 'subgroup' + group.id, classes: 'collapse subgroup'});

		div.appendChild(anchor);
		div.appendChild(subgroup);
		parent.appendChild(div);

		setTimeout(function() { addGroups(subgroup, group.subgroups, depth + 1) }, 1);
		
		if (Object.keys(group.items).length > 0) {
			let ul = createElement('ul');
			for (let itemName of Object.keys(group.items).sort()) {
				let item = group.items[itemName];
				let li = createElement('li', undefined, {item_id: item.item_id, classes: 'itemname'});
				li.onclick = litem;
				let anchor = createElement('a', item.name, {item_id: item.item_id, href: '/item/' + item.item_id});
				anchor.onclick = litem;
				li.appendChild(anchor);
				ul.appendChild(li);

				itemName = itemName.toLowerCase();
				for (let i = 1; i <= itemName.length; i++) addToSearch(itemName.substr(0, i), itemName, li);
			}
			subgroup.appendChild(ul);
		}
	}
}

function addToSearch(substr, name, element) {
	if (typeof searcharray[substr] === 'undefined') searcharray[substr] = {};
	searcharray[substr][name] = element;
}

function doSearch(e) {
	const text = e.target.value;
	let shown = document.querySelectorAll('.groupname[aria-expanded="true"]');
	let matches = document.getElementsByClassName('match');

	[...Object.values(matches)].map((li) => li.classList.remove('match'));

	if (text.length == 0) {
		document.getElementById('itemparent').classList.remove('searching');
	} else {
		document.getElementById('itemparent').classList.add('searching');

		let matches = searcharray[text];
		if (typeof matches == 'undefined') return;
		matches = Object.values(matches);
		[...Object.values(matches)].map((li) => itemMatch(li));
	}
}

function itemMatch(elem) {
	do {		
		elem.classList.add('match');
		elem = elem.parentNode;
	} while (elem.getAttribute('id') != 'items');
}

function stopCollapseToggleWhenSearching(event) {
	if (ddocument.getElementById('itemparent').classList.contains('searching')) event.stopPropagation();
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
	document.title = data.name + ' - EVEconomy';
	assembleColumns('buyorders', data.buy);
	assembleColumns('sellorders', data.sell);

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
	'price': {format: 'dec', classes: 'text-end'},
	'volume_remain': {format: 'int', classes: 'text-end'},
	'range': {classes: 'text-end capitalize'},
};
function assembleColumns(id, orders) {
	let table = createElement('table', undefined, {classes: 'table table-sm table-striped'});
	table.appendChild(createElement('thead', THEAD, undefined, undefined));
	let tablebody = createElement('tbody');
	table.appendChild(tablebody);

	for (let order of orders) {
		let tr = createElement('tr');
		for (let column of Object.keys(columns)) {
			let val = order[column];
			if (columns[column]['format']) val = getValueFormatted(val, columns[column]['format']);
			tr.appendChild(createElement('td', val, columns[column]));
		}
		tablebody.append(tr);
	}

	let div = document.getElementById(id);
	div.innerHTML = '';
	div.appendChild(table);
	setTimeout(loadGroups, 1);
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
	int: 0,
	dec: 2
}
function getValueFormatted(value, format) {
	let n = value.length > 10 ? BigInt(value) : Number(value);
	let dec = formats[format];
	return n.toLocaleString(undefined, {minimumFractionDigits: dec, maximumFractionDigits: dec});
}