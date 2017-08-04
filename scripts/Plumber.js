Plumber = f.unit({
	unitName: 'Plumber',

	srcAtlas: 'images/atlas.svg',
	srcCubemap: 'images/textures/cubemap.png',
	srcConfig: 'configs/samples.json',
	srcSamples: 'samples/',

	init: function(options) {
		for(var name in options) this[name] = options[name]

		this.get   = new Loader
		this.timer = new Timer(this.onTick, this)
		this.file  = new FileImport

		this.imagery = new Imagery

		this.events = new EventEmitter

		this.sampler = new Sampler
		this.sampler.setImagery(this.imagery)
		this.sampler.folder = this.srcSamples



		this.renderer = new THREE.WebGLRenderer({
			alpha: false,
			depth: true,
			stencil: true,
			antialias: true,
			preserveDrawingBuffer: true
		})
		this.renderer.autoClear = false



		this.view = new View3({
			// eroot: document.body,
			renderer: this.renderer,
			// clearColor: 0xFF00FF
		})

		this.view2 = new View3({
			// eroot: document.body,
			renderer: this.renderer,
			enableStencil: false,
			enableRaycast: false
			// clearColor: 0x00FF00
		})

		this.list = dom.div('samples-list')


		this.tiles = new TileView
		this.tiles.setLayout(['h', ['h', 0, 0, 1], 0, 0.8])
		this.tiles.setClients([
			this.view,
			this.view2,
			{ element: this.list }
		])

		this.splitView = this.tiles.splits[0]


		this.viewTween = new TWEEN.Tween(this.splitView)
			.to({ position: this.splitView.position }, 400)
			.easing(TWEEN.Easing.Cubic.Out)
			.onUpdate(this.tiles.update, this.tiles)



		this.splitViewMessage = dom.div('split-view-message')
		dom.text(this.splitViewMessage, 'no compatible connections')
		dom.display(this.splitViewMessage, false)



		this.element = this.tiles.element


		this.makeDeletePrompt()


		dom.addclass(this.element, 'ontouchstart' in window ? 'touch' : 'no-touch')
		dom.addclass(this.renderer.domElement, 'canvas-main')
		dom.prepend(this.element, this.renderer.domElement)
		dom.append(this.element, this.splitViewMessage)
		dom.append(this.list, this.file.element)

		dom.append(document.body, this.tiles.element)

		this.fetch()
	},

	fetch: function() {
		this.get.xml(this.srcAtlas).defer
			.then(Atlas.setSource)

		this.get.image(this.srcCubemap).defer
			.then(this.imagery.unwrapCubemap3x2, this.imagery)

		this.get.json(this.srcConfig).defer
			.then(this.sampler.addSampleList, this.sampler)
			.then(this.makeMenu, this)
			.detach(this.run, this)
	},

	makeDeletePrompt: function() {
		var tip = new Block.Tip({
			eroot: this.element,
			align: 'top',
			hidden: true
		})

		dom.addclass(tip.element, 'prompt')

		var text = dom.div('prompt-text', tip.content)
		,   ok   = dom.div('prompt-button hand prompt-button-ok', tip.content)
		,   no   = dom.div('prompt-button hand prompt-button-cancel', tip.content)

		dom.text(ok, 'Yes')
		dom.text(no, 'No')

		new EventHandler(this.deleteNode, this).listen('tap', ok)
		new EventHandler(this.closeDeletePrompt, this).listen('tap', no)

		this.deletePromptTipText = text
		this.deletePromptTip = tip
	},

	makeMenu: function() {
		this.sampleMenu = new Block.Menu({
			eroot: this.list,
			ename: 'sample-menu',
			deselect: true,

			options: {
				factory: Block.Toggle,
				ename: 'sample-item'
			},

			items: this.sampler.getList().map(function(sid) {
				return {
					text: this.sampler.samples[sid].name,
					data: sid
				}
			}, this)
		})

		this.sampleMenu.events.on('add-block', this.onSubAdd, this)
		this.sampleMenu.blocks.forEach(this.onSubAdd, this)

		this.makeGUI()
	},

	makeGUI: function() {
		this.gui = new dat.GUI({
			// autoPlace: false,
			hideable: false
		})

		this.gui.closed = true

		this.gui.addColor(this.view.stencilHover.params, 'drawColor').name('Hover').onChange(redraw)
		this.gui.addColor(this.view.stencilSelect.params, 'drawColor').name('Select').onChange(redraw)

		var self = this
		function redraw() {
			self.view.needsRedraw = true
			self.view2.needsRedraw = true
		}
	},

	onSubAdd: function(block) {
		block.element.setAttribute('draggable', true)

		block.watchEvents.push(
			new EventHandler(this.onSubDrag, this, block).listen('dragstart', block.element))
	},

	onSubDrag: function(block, e) {
		e.dataTransfer.setData('text/sample', block.data)
	},

	onSubChange: function(sid) {
		this.displaySample(sid)
	},



	onViewClear: function() {
		this.tree = null
		this.view.setTree(null)
		this.displaySample(null)
	},

	onViewClear2: function() {
		this.displaySample(null)
	},


	displaySample: function(sid) {
		var sample = this.sampler.samples[sid]
		if(sample === this.sampleView2) return

		this.sampleView2 = this.tree ? sample : null
		this.sampleMenu.setItem(this.sampleView2 && this.sampleView2.id)

		this.splitScreen = this.sampleView2 && (this.sampleView2.object || this.sampleView2.src)

		if(!this.splitScreen) {
			this.view.markers.markersVisible.off('view2')
			this.view2.markers.markersVisible.off('view2')

			dom.display(this.splitViewMessage, false)
		}

		this.view.enableRaycast = !this.splitScreen

		this.view.hoverNode(null)
		this.view.selectNode(null)
		this.view.selectConnection(null)

		var splitPosition = this.splitScreen ? 0.5 : 1
		if(splitPosition !== this.viewTween.target.position) {
			this.viewTween.target.position = splitPosition
			this.viewTween.start()
		}

		this.preloadSample(sample, this.setSample, this)
	},

	preloadSample: function(sample, onComplete, scope) {
		if(this.deferSample) {
			this.deferSample.set(null)
			this.deferSample = null
		}
		if(sample) {
			this.deferSample = sample.load().detach(onComplete, scope || this)
		}
	},


	setSample: function(sample) {
		if(!sample) return

		var node = new TNode(sample)

		if(this.tree) {
			this.view2.setTree(node)
			this.updateConnectionGroups(this.tree, node)

			this.view.markers.markersVisible.on('view2')
			this.view2.markers.markersVisible.on('view2')

		} else {
			this.tree = node
			this.view.setTree(node)
		}
	},

	updateConnectionGroups: function(tree, tree2) {
		this.cons  = tree  && tree .retrieveConnections({ connected: false }, true) || []
		this.cons2 = tree2 && tree2.retrieveConnections({ connected: false }, true) || []

		var groups2 = []

		for(var i = 0; i < this.cons2.length; i++) {
			this.cons2[i].group = -1
		}

		for(var i = 0; i < this.cons.length; i++) {
			var con = this.cons[i]
			var list = con.canConnectList(this.cons2)

			con.group = -1

			if(list.length) {
				var found = false
				for(var j = 0; j < groups2.length; j++) {

					if(!f.seq(list, groups2[j])) continue

					con.group = j
					found = true
					break
				}

				if(!found) {
					var gi = groups2.length

					con.group = gi
					for(var j = 0; j < list.length; j++) {
						list[j].group = gi
					}

					groups2.push(list)
				}
			}
		}

		// console.log(groups2.length)
		this.hasAvailableConnections = groups2.length
		dom.display(this.splitViewMessage, !this.hasAvailableConnections)
		this.updateSplitViewMessagePosition()
		this.updateConnectionVisibilitySets()

		this.view.needsRetrace = true
	},

	updateConnectionVisibilitySets: function() {
		if(this.cons) for(var i = 0; i < this.cons.length; i++) {
			this.updateConnectionVisibility(this.cons[i], this.connectionParts[1])
		}
		if(this.cons2) for(var i = 0; i < this.cons2.length; i++) {
			this.updateConnectionVisibility(this.cons2[i], this.connectionParts[0])
		}
	},

	updateConnectionVisibility: function(con, match) {
		var available = con.group !== -1
		,   compatible = match ? con.canConnect(match) : true

		con.marker.visible.set(!this.hasAvailableConnections || available, 'active')
		con.inactive.set(!available || !compatible, 'view2')
		con.marker.updateState()
	},

	connectSample: function(sample) {
		if(!sample) return

		var node = new TNode(sample)

		if(this.tree) {
			var cons = this.tree.retrieveConnections({ connected: false }, true)

			loop_cons:
			for(var i = 0; i < cons.length; i++) {
				var conA = cons[i]

				for(var j = 0; j < node.connections.length; j++) {
					var conB = node.connections[j]

					if(conA.canConnect(conB)) {
						conA.node.connect(conA.index, node, conB.index)
						this.view.setTree(this.tree)
						break loop_cons
					}
				}
			}

		} else {
			this.tree = node
			this.view.setTree(this.tree)
		}


		if(this.splitScreen) {
			this.updateConnectionGroups(this.tree, this.view2.tree)
		}
	},


	onkey: function(e) {
		if(e.ctrlKey || e.shiftKey || e.altKey) {

		} else if(kbd.down && kbd.changed) switch(kbd.key) {
			case 'DEL':
				this.promptDeleteNode(this.view.nodeSelected)
			return

			case 'c':
				this.view.focusOnTree()
				this.view2.focusOnTree()
			return

			case 'x':
				this.debug = !this.debug
				this.imagery.materials.subtract.visible = !!this.debug
				this.imagery.materials.norcon.visible = !!this.debug
				if(this.debug && this.view2.tree) this.view2.tree.sample.describe()
			break

			case 't':
				var sid = f.any(Object.keys(this.sampler.samples))
				this.preloadSample(this.sampler.samples[sid], this.connectSample)
			break

			case 'v':
				this.gui.closed ? this.gui.open() : this.gui.close()
			return
		}

		this.view.onKey(e)
		this.view2.onKey(e)
	},

	promptDeleteNode: function(node) {
		if(!node) return

		this.deletePromptStat = node.pinch()

		if(this.deletePromptStat.removeCount < 2) {
			this.deleteNode()

		} else {
			dom.text(this.deletePromptTipText,
				['Do you want to delete', this.deletePromptStat.removeCount, 'nodes?'].join(' '))

			this.deletePromptTip.visible.on()
		}
	},


	closeDeletePrompt: function() {
		this.deletePromptTip.visible.off()
		delete this.deletePromptStat
	},


	deleteNode: function() {
		var stats = this.deletePromptStat
		if(!stats) return

		stats.removeNode.disconnect()
		this.tree = stats.maxRoot
		this.view.setTree(this.tree)
		this.view.selectNode(null)

		this.closeDeletePrompt()
	},


	// onhashchange: function(e) {
	// 	this.displaySample(location.hash.slice(1))
	// }

	onresize: function() {
		var e = this.tiles.element
		,   w = e.offsetWidth
		,   h = e.offsetHeight

		this.renderer.setSize(w, h)
		this.tiles.autoresize()

		this.view.resizeRenderTargets(w, h)
		this.view.resizeShaders(w, h)
		// this.view.onResize()
	},

	updateSplitViewMessagePosition: function() {
		var elem = this.splitViewMessage
		,   vp   = this.splitView
		,   svw  = elem.offsetWidth
		,   svh  = elem.offsetHeight
		,   sx   = vp.split === TileView.VERTICAL_SPLIT   ? 0.5 : vp.position
		,   sy   = vp.split === TileView.HORIZONTAL_SPLIT ? 0.5 : vp.position
		,   cx   = vp.x + vp.w * sx - svw / 2
		,   cy   = vp.y + vp.h * sy - svh / 2

		elem.style.left = cx +'px'
		elem.style.top  = cy + 0.3 * vp.h +'px'
	},

	onTilesUpdate: function() {

		if(!this.hasAvailableConnections) {
			this.updateSplitViewMessagePosition()
		}

		return

		var canvas = this.renderer.domElement
		,   frame  = this.splitView

		if(canvas.width  !== frame.w
		|| canvas.height !== frame.h) {
			this.renderer.setSize(frame.w, frame.h)
		}

		canvas.style.left = frame.x +'px'
		canvas.style.top  = frame.y +'px'
	},

	onTap: function(e) {
		if(this.deletePromptTip.visible.value) {
			if(!dom.ancestor(e.target, this.deletePromptTip.element)
			&& !dom.ancestor(e.target, this.view.markers.element)) {
				this.closeDeletePrompt()
			}
		}
	},

	onDragOver: function(e) {
		e.dataTransfer.dropEffect = 'copy'
		e.preventDefault()
	},

	onDrop: function(e) {
		var dt = e.dataTransfer

		var file = dt.files[0]
		if(file) {
			this.file.importJSON(file)

		} else {
			var sid = dt.getData('text/sample')
			,   sample = this.sampler.samples[sid]

			this.preloadSample(sample, this.connectSample)
		}

		e.preventDefault()
	},

	onSampleImport: function(item) {
		var sample = this.sampler.addSample(item)
		var menu = this.sampleMenu

		var block = menu.addItem({
			data: sample.id,
			text: sample.name
		})

		block.remove = dom.div('sample-remove absmid hand', block.element)

		block.watchAtlas.push(
			Atlas.set(block.remove, 'i-cross', 'absmid'))

		block.watchEvents.push(
			new EventHandler(removeSample, null, block).listen('tap', block.remove))

		menu.set(menu.blocks.indexOf(block), true)
	},


	onNodeSelect: function(node, prev) {
		var system = this.view.markers
		if(prev && prev.nodeMarker) {
			system.removeMarker(prev.nodeMarker)
			prev.nodeMarker.htap.release()
			prev.nodeMarker = null
		}

		if(node) {
			var m = this.view.markers.addMarker(node.localBox.getCenter(), 'remove', null, true)
			m.deleteNode = node
			m.align = 'bottom'
			m.visible.on()

			m.htap = new EventHandler(this.promptDeleteNode, this, node).listen('tap', m.element)
			m.watchAtlas.push(Atlas.set(dom.div('marker-delete', m.content), 'i-delete'))

			node.nodeMarker = m


			if(!kbd.state.SHIFT) {
				this.view.focusOnNode(node)
			}
		}
	},

	onConnectionSelect: function(view, index, con) {
		if(!this.connectionParts) {
			this.connectionParts = []
		}

		this.connectionParts[index] = con

		this.updateConnectionVisibilitySets()

		var master = this.connectionParts[0]
		,   slave  = this.connectionParts[1]

		if(master && slave) this.makeViewConnection(master, slave)
	},

	makeViewConnection: function(master, slave) {
		this.view.selectConnection(null)
		this.view2.selectConnection(null)
		this.view2.setTree(null)

		master.node.connect(master.index, slave.node, slave.index)

		this.view.setTree(this.tree)


		this.animatedConnection = master
		master.events.once('connect_start', function() {
			this.animatedConnection = master
		}, this)
		master.events.once('connect_end', function() {
			delete this.animatedConnection
		}, this)

		master.playConnection()

		this.displaySample(null)
	},

	removeSample: function(block) {
		this.sampleMenu.removeBlock(block, true)

		var sample = this.sampler.samples[block.data]
		if(sample) {
			delete this.sampler.samples[sample.id]
		}
	},

	run: function() {
		// new EventHandler(this.onhashchange, this).listen('hashchange', window)
		new EventHandler(this.onresize, this).listen('resize',  window)
		new EventHandler(this.onkey,    this).listen('keydown', window)
		new EventHandler(this.onkey,    this).listen('keyup',   window)
		new EventHandler(this.onTap,    this).listen('tap',     window)

		new EventHandler(this.onDragOver, this).listen('dragover', this.view .element)
		new EventHandler(this.onDragOver, this).listen('dragover', this.view2.element)
		new EventHandler(this.onDrop,     this).listen('drop',     this.view .element)
		new EventHandler(this.onDrop,     this).listen('drop',     this.view2.element)

		this.sampleMenu.events.on('change', this.onSubChange, this)
		this.file.events.on('import', this.onSampleImport, this)

		this.tiles.events.on('update', this.onTilesUpdate, this)

		this.view.events.on('connection_select', this.onConnectionSelect, this, [this.view, 0])
		this.view2.events.on('connection_select', this.onConnectionSelect, this, [this.view2, 1])

		this.view.events.on('view_clear', this.onViewClear, this)
		this.view2.events.on('view_clear', this.onViewClear2, this)

		this.view.events.on('node_select', this.onNodeSelect, this)

		this.onresize()
		// this.onhashchange()
		bootProgress(1)
		this.timer.play()
	},

	onTick: function(t, dt) {
		if(this.animatedConnection) {
			this.view.needsRedraw = true
			this.view.needsRetrace = true
		}

		TWEEN.update()

		this.view.onTick(dt)
		this.view2.onTick(dt)

		if(this.deletePromptStat) {
			var p = this.view.projector.worldToScreen(this.deletePromptStat.removeNode.localCenter)
			this.deletePromptTip.move(Math.round(p.x), Math.round(p.y))
		}
	}
})




