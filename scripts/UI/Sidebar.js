UI.Sidebar = f.unit(Block, {
	unitName: 'UI_Sidebar',
	ename: 'sidebar',

	create: function() {
		this.get = new Loader

		this.file = new FileImport
		dom.append(this.element, this.file.element)


		this.sampleMenu = new Block.Menu({
			eroot: this.element,
			ename: 'sample-menu',
			deselect: true,

			options: {
				factory: Block.Toggle,
				ename: 'sample-item'
			}
		})

		this.sampleMenu.events.relay('change', this.events, 'sample_change')
		this.file.events.relay('import', this.events, 'file_import')

		dom.addclass(this.element, 'ontouchstart' in window ? 'touch' : 'no-touch')
	},

	addSample: function(data, name, thumb, removable, start) {
		var menu = this.sampleMenu

		this.remSample(data)

		var block = menu.addItem({ data: data })

		if(start) dom.prepend(menu.element, block.element)

		block.element.setAttribute('draggable', true)

		block.watchEvents.push(
			new EventHandler(this.onSampleDrag, this, block).listen('dragstart', block.element))


		if(thumb) {
			dom.addclass(block.element, 'thumbed')
			dom.img(thumb, 'sample-thumb', block.element)
		}

		if(name) {
			dom.text(dom.div('sample-name', block.element), name)
		}

		if(removable) {
			block.remove = dom.div('sample-remove hand', block.element)

			block.watchAtlas.push(
				Atlas.set(block.remove, 'i-cross', 'absmid'))

			block.watchEvents.push(
				new EventHandler(this.onSampleRemove, this, block).listen('tap', block.remove))
		}
	},

	remSample: function(data) {
		var menu = this.sampleMenu

		for(var i = menu.blocks.length -1; i >= 0; i--) {
			var block = menu.blocks[i]

			if(block.data.id === data.id) {
				menu.removeBlock(block)
			}
		}
	},

	setSample: function(data) {
		this.sampleMenu.setItem(data)
	},

	onSampleRemove: function(block) {
		this.sampleMenu.removeBlock(block, true)

		this.events.emit('sample_remove', block.data)
	},

	onSampleDrag: function(block, e) {
		e.dataTransfer.setData('text/sid', block.data)
	}
})
