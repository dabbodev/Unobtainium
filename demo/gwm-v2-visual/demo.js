(function () {
  'use strict';

  const fixturePath = '../../docs/examples/gwm-v2-visual-demo-fixture.json';
  const statusNode = document.getElementById('load-status');

  function text(value) {
    if (Array.isArray(value)) {
      return value.map(text).join(', ');
    }

    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  function valueOrFallback(value, fallback) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value;
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function el(tagName, className, content) {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (content !== undefined) {
      node.textContent = content;
    }
    return node;
  }

  function code(value) {
    return el('code', '', text(value));
  }

  function formatPoint(point) {
    return `(${point.map((axis) => String(axis)).join(', ')})`;
  }

  function panel(name) {
    return document.querySelector(`[data-panel="${name}"]`);
  }

  function panelNote(content) {
    return el('p', 'panel-note', content);
  }

  function keyValueList(entries) {
    const list = el('ul', 'kv-list');
    entries.forEach(([key, value]) => {
      const item = el('li');
      item.append(el('span', 'key', key));
      item.append(code(value));
      list.append(item);
    });
    return list;
  }

  function compactKeyValueList(entries) {
    const list = keyValueList(entries);
    list.className = 'kv-list compact-kv';
    return list;
  }

  function simpleTable(headers, rows, className) {
    const table = el('table');
    if (className) {
      table.className = className;
    }
    const thead = el('thead');
    const headRow = el('tr');
    headers.forEach((header) => headRow.append(el('th', '', header)));
    thead.append(headRow);
    table.append(thead);

    const tbody = el('tbody');
    rows.forEach((row) => {
      const tr = el('tr');
      row.forEach((cell) => {
        const td = el('td');
        td.append(code(cell));
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(tbody);
    return table;
  }

  function recordList(records, describe) {
    const list = el('ul', 'record-list');
    records.forEach((record, index) => {
      const item = el('li', 'record');
      item.append(describe(record, index));
      list.append(item);
    });
    return list;
  }

  function recordsByIndex(records) {
    return records.reduce((lookup, record) => {
      lookup[record.recordIndex] = record;
      return lookup;
    }, {});
  }

  function formatRotateSummary(rotate) {
    if (!rotate) {
      return 'not available';
    }

    return `${rotate.direction} ${rotate.delta} on ring ${rotate.ring} (${rotate.mixPattern})`;
  }

  function formatPositionSummary(position) {
    if (!position) {
      return 'not available';
    }

    return `swap-like descriptor ${position.a}<->${position.b}, span ${position.span}, seed ${position.seed}`;
  }

  function formatRuleSummary(rule) {
    if (!rule) {
      return 'not available';
    }

    return `${rule.angleBucket}, degenerate=${rule.degenerate}, ${rule.mixPattern}`;
  }

  function renderOverview(fixture) {
    const target = panel('overview');
    target.append(keyValueList([
      ['format', fixture.fixture.format],
      ['version', fixture.fixture.version],
      ['source sprint', fixture.fixture.sprint],
      ['purpose', fixture.fixture.purpose],
      ['generated from helpers', fixture.fixture.generatedFromExistingHelpers],
      ['not production cryptography', fixture.securityFraming.notProductionCryptography],
      ['no security guarantee', 'commitments are deterministic integrity/check artifacts only']
    ]));

    const notes = el('ul', 'notes');
    fixture.notes.forEach((note) => notes.append(el('li', '', note)));
    target.append(el('h3', '', 'Fixture notes'));
    target.append(notes);
  }

  function renderPoints(fixture) {
    const target = panel('points');
    target.append(panelNote('Source point order is visible because ordered geometry is part of this fixture key identity. Reordering the same coordinates would describe different demo material.'));
    target.append(simpleTable(
      ['order', 'point ref', 'coordinates', 'identity role'],
      fixture.points.map((point, index) => [
        index,
        `P${index}`,
        formatPoint(point),
        index === fixture.walkOptions.point ? 'walk start' : 'ordered source point'
      ]),
      'compact-table'
    ));
    target.append(keyValueList([
      ['source point commitment', fixture.gwmV2Descriptor.sourcePointCommitment]
    ]));
  }

  function renderWalk(fixture) {
    const target = panel('walk');
    target.append(panelNote('These walk options are deterministic demo inputs from the checked-in fixture. They are not randomness, secrecy, or a security guarantee.'));
    target.append(keyValueList(Object.entries(fixture.walkOptions)));
  }

  function renderTriads(fixture) {
    const target = panel('triads');
    target.append(panelNote('Triads are ordered fixture records. A, B, and C are not interchangeable; the displayed A -> B -> C order is part of the deterministic mechanism.'));
    target.append(recordList(fixture.selectedTriads, (record) => {
      const wrapper = el('div');
      wrapper.append(el('h3', 'record-title', `Triad record ${record.index}: A -> B -> C`));
      const path = el('div', 'triad-path');
      ['A', 'B', 'C'].forEach((label) => {
        const node = el('div', 'triad-node');
        node.append(el('div', 'triad-label', label));
        node.append(keyValueList([
          ['source point index', record.pointIndexes[label]],
          ['point ref', `P${record.pointIndexes[label]}`],
          ['coordinates', formatPoint(record.triad[label])]
        ]));
        path.append(node);
      });
      wrapper.append(path);
      return wrapper;
    }));
  }

  function renderFeatures(fixture) {
    const target = panel('features');
    target.append(panelNote('Feature extraction is deterministic fixture material. The summaries group single-point, pairwise-edge, and whole-triangle families without treating complexity as cryptographic uncertainty.'));
    target.append(recordList(fixture.triadFeatures, (record) => {
      const triad = fixture.selectedTriads.find((candidate) => candidate.index === record.recordIndex);
      const families = record.summary.sourceFeatureFamilies;
      const hasFamily = (name) => families.indexOf(name) !== -1 ? 'included' : 'not listed';
      const wrapper = el('div');
      wrapper.append(el('h3', 'record-title', `Feature record ${record.recordIndex}`));

      const grid = el('div', 'feature-grid');
      const pointSummary = el('div', 'feature-summary');
      pointSummary.append(el('h4', '', 'Single-point features'));
      pointSummary.append(el('p', '', `${hasFamily('points')}; order-sensitive: ${record.summary.pointOrderSensitive}`));
      if (triad) {
        pointSummary.append(keyValueList([
          ['A source', `P${triad.pointIndexes.A} ${formatPoint(triad.triad.A)}`],
          ['B source', `P${triad.pointIndexes.B} ${formatPoint(triad.triad.B)}`],
          ['C source', `P${triad.pointIndexes.C} ${formatPoint(triad.triad.C)}`]
        ]));
      }

      const edgeSummary = el('div', 'feature-summary');
      edgeSummary.append(el('h4', '', 'Pairwise-edge features'));
      edgeSummary.append(el('p', '', `${hasFamily('edges')}; ordered pairs AB, BC, and CA are summarized by the fixture feature family.`));
      edgeSummary.append(keyValueList([
        ['mix pattern', record.mixPattern]
      ]));

      const triangleSummary = el('div', 'feature-summary');
      triangleSummary.append(el('h4', '', 'Whole-triangle features'));
      triangleSummary.append(el('p', '', `${hasFamily('triangle')}; triangle-level bucket and degeneracy are deterministic outputs in this fixture.`));
      triangleSummary.append(keyValueList([
        ['angle bucket', record.angleBucket],
        ['degenerate', record.degenerate]
      ]));

      grid.append(pointSummary);
      grid.append(edgeSummary);
      grid.append(triangleSummary);
      wrapper.append(grid);
      wrapper.append(keyValueList([
        ['source feature families', families],
        ['feature commitment', record.featureCommitment]
      ]));
      return wrapper;
    }));
  }

  function renderChannel(fixture, name, rowsFor) {
    panel(name).append(recordList(fixture.instructionChannels, (record) => keyValueList(rowsFor(record))));
  }

  function renderStream(fixture) {
    const target = panel('stream');
    target.append(panelNote('Triad stream records are deterministic descriptor records from the checked-in fixture. This panel does not apply encryption or run transform logic.'));
    target.append(keyValueList([
      ['format', fixture.triadStream.format],
      ['version', fixture.triadStream.version],
      ['record count', fixture.triadStream.recordCount],
      ['context', fixture.triadStream.context],
      ['stream commitment', fixture.triadStream.streamCommitment]
    ]));
    target.append(el('h3', '', 'Stream records'));
    const features = recordsByIndex(fixture.triadFeatures);
    target.append(recordList(fixture.instructionChannels, (record, order) => {
      const feature = features[record.recordIndex] || {};
      const wrapper = el('div');
      wrapper.append(el('h3', 'record-title', `Stream record ${record.recordIndex} (order ${order})`));
      wrapper.append(compactKeyValueList([
        ['triad feature commitment', valueOrFallback(feature.featureCommitment, 'not available')],
        ['triad instruction commitment', record.instructionCommitment],
        ['rotate descriptor', formatRotateSummary(record.rotate)],
        ['position descriptor', formatPositionSummary(record.position)],
        ['rule descriptor', formatRuleSummary(record.rule)]
      ]));
      return wrapper;
    }));
  }

  function renderAdapter(fixture) {
    const target = panel('adapter');
    target.append(panelNote('Adapter plan entries are descriptor summaries only. They are not applied transforms and do not mutate payloads or legacy GWM behavior.'));
    target.append(keyValueList([
      ['format', fixture.adapterPlan.format],
      ['version', fixture.adapterPlan.version],
      ['source stream commitment', fixture.adapterPlan.sourceStreamCommitment],
      ['rotate instruction count', fixture.adapterPlan.rotateInstructionCount],
      ['swap instruction count', fixture.adapterPlan.swapInstructionCount],
      ['skipped record count', fixture.adapterPlan.skippedRecordCount],
      ['adapter plan commitment', fixture.adapterPlan.adapterCommitment]
    ]));

    target.append(el('h3', '', 'Rotate instruction descriptors'));
    target.append(recordList(fixture.instructionChannels, (record) => {
      const wrapper = el('div');
      wrapper.append(el('h3', 'record-title', `Rotate descriptor for record ${record.recordIndex}`));
      wrapper.append(compactKeyValueList([
        ['summary', formatRotateSummary(record.rotate)],
        ['delta', record.rotate.delta],
        ['direction', record.rotate.direction],
        ['ring', record.rotate.ring],
        ['source instruction commitment', record.instructionCommitment]
      ]));
      return wrapper;
    }));

    target.append(el('h3', '', 'Swap instruction descriptors'));
    target.append(recordList(fixture.instructionChannels, (record) => {
      const wrapper = el('div');
      wrapper.append(el('h3', 'record-title', `Swap descriptor for record ${record.recordIndex}`));
      wrapper.append(compactKeyValueList([
        ['summary', formatPositionSummary(record.position)],
        ['a', record.position.a],
        ['b', record.position.b],
        ['span', record.position.span],
        ['seed', record.position.seed],
        ['source instruction commitment', record.instructionCommitment]
      ]));
      return wrapper;
    }));

    target.append(el('h3', '', 'Skipped records / warnings'));
    target.append(keyValueList([
      ['skipped records', fixture.adapterPlan.skippedRecordCount || 'none listed in fixture'],
      ['warnings', valueOrFallback(fixture.adapterPlan.warningCount, 'none listed in fixture')]
    ]));
  }

  function renderProof(fixture) {
    const target = panel('proof');
    target.append(panelNote('This is an isolated proof summary from fixture data. It is not a production cipher mode, not default UN-GWM behavior, and not a security guarantee.'));
    target.append(keyValueList([
      ['format', fixture.transformProofSummary.format],
      ['version', fixture.transformProofSummary.version],
      ['mode', fixture.transformProofSummary.mode],
      ['source plan commitment', fixture.transformProofSummary.sourcePlanCommitment],
      ['input payload commitment', fixture.transformProofSummary.inputPayloadCommitment],
      ['output payload commitment', fixture.transformProofSummary.outputPayloadCommitment],
      ['roundtrip summary', valueOrFallback(fixture.transformProofSummary.roundtrip, 'fixture summary omits raw roundtrip payload bytes')],
      ['applied operation count', fixture.transformProofSummary.appliedOperationCount],
      ['skipped record count', fixture.transformProofSummary.skippedRecordCount],
      ['warning count', fixture.transformProofSummary.warningCount],
      ['proof commitment', fixture.transformProofSummary.proofCommitment],
      ['note', fixture.transformProofSummary.note]
    ]));

    target.append(el('h3', '', 'Applied operation summary'));
    target.append(keyValueList([
      ['rotate descriptors summarized', fixture.adapterPlan.rotateInstructionCount],
      ['swap descriptors summarized', fixture.adapterPlan.swapInstructionCount],
      ['total fixture operation count', fixture.transformProofSummary.appliedOperationCount],
      ['proof source', 'checked-in transformProofSummary and adapterPlan fields only']
    ]));
  }

  function renderDescriptorPanels(fixture) {
    renderAdapter(fixture);
    renderProof(fixture);
    const target = panel('descriptor');
    target.append(panelNote('UN-GWM-V2 wrapping is explicit and opt-in in this fixture summary. It is not default UN-GWM and does not replace existing GWM behavior.'));
    target.append(el('h3', '', 'Commitment chain'));
    target.append(keyValueList([
      ['source point commitment', fixture.gwmV2Descriptor.sourcePointCommitment],
      ['triad stream commitment', fixture.gwmV2Descriptor.triadStreamCommitment],
      ['adapter plan commitment', fixture.gwmV2Descriptor.adapterPlanCommitment],
      ['proof commitment', fixture.gwmV2Descriptor.transformProofCommitment],
      ['descriptor commitment', fixture.gwmV2Descriptor.descriptorCommitment],
      ['mode commitment', fixture.gwmV2Mode.modeCommitment]
    ]));
    target.append(el('h3', '', 'Descriptor'));
    target.append(keyValueList(Object.entries(fixture.gwmV2Descriptor)));
    target.append(el('h3', '', 'Mode wrapper'));
    target.append(keyValueList(Object.entries(fixture.gwmV2Mode)));
  }

  function renderFixture(fixture) {
    document.querySelectorAll('[data-panel]').forEach(clear);
    renderOverview(fixture);
    renderPoints(fixture);
    renderWalk(fixture);
    renderTriads(fixture);
    renderFeatures(fixture);
    renderChannel(fixture, 'rotate', (record) => [
      ['record index', record.recordIndex],
      ['delta', record.rotate.delta],
      ['direction', record.rotate.direction],
      ['ring', record.rotate.ring],
      ['mix pattern', record.rotate.mixPattern],
      ['instruction commitment', record.instructionCommitment]
    ]);
    renderChannel(fixture, 'position', (record) => [
      ['record index', record.recordIndex],
      ['a', record.position.a],
      ['b', record.position.b],
      ['span', record.position.span],
      ['seed', record.position.seed],
      ['instruction commitment', record.instructionCommitment]
    ]);
    renderChannel(fixture, 'rule', (record) => [
      ['record index', record.recordIndex],
      ['angle bucket', record.rule.angleBucket],
      ['degenerate', record.rule.degenerate],
      ['mix pattern', record.rule.mixPattern],
      ['instruction commitment', record.instructionCommitment]
    ]);
    renderStream(fixture);
    renderDescriptorPanels(fixture);
  }

  fetch(fixturePath)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Fixture request failed with status ${response.status}`);
      }
      return response.json();
    })
    .then((fixture) => {
      renderFixture(fixture);
      statusNode.textContent = `Loaded local fixture: ${fixturePath}`;
    })
    .catch((error) => {
      statusNode.className = 'error';
      statusNode.textContent = `Could not load the local fixture at ${fixturePath}. Serve the repository root with a local static server and reload. ${error.message}`;
    });
}());
