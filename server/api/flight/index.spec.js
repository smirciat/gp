'use strict';

var proxyquire = require('proxyquire').noPreserveCache();

var flightCtrlStub = {
  index: 'flightCtrl.index',
  show: 'flightCtrl.show',
  create: 'flightCtrl.create',
  update: 'flightCtrl.update',
  destroy: 'flightCtrl.destroy'
};

var routerStub = {
  get: sinon.spy(),
  put: sinon.spy(),
  patch: sinon.spy(),
  post: sinon.spy(),
  delete: sinon.spy()
};

// require the index with our stubbed out modules
var flightIndex = proxyquire('./index.js', {
  'express': {
    Router: function() {
      return routerStub;
    }
  },
  './flight.controller': flightCtrlStub
});

describe('Flight API Router:', function() {

  it('should return an express router instance', function() {
    expect(flightIndex).to.equal(routerStub);
  });

  describe('GET /api/flights', function() {

    it('should route to flight.controller.index', function() {
      expect(routerStub.get
        .withArgs('/', 'flightCtrl.index')
        ).to.have.been.calledOnce;
    });

  });

  describe('GET /api/flights/:id', function() {

    it('should route to flight.controller.show', function() {
      expect(routerStub.get
        .withArgs('/:id', 'flightCtrl.show')
        ).to.have.been.calledOnce;
    });

  });

  describe('POST /api/flights', function() {

    it('should route to flight.controller.create', function() {
      expect(routerStub.post
        .withArgs('/', 'flightCtrl.create')
        ).to.have.been.calledOnce;
    });

  });

  describe('PUT /api/flights/:id', function() {

    it('should route to flight.controller.update', function() {
      expect(routerStub.put
        .withArgs('/:id', 'flightCtrl.update')
        ).to.have.been.calledOnce;
    });

  });

  describe('PATCH /api/flights/:id', function() {

    it('should route to flight.controller.update', function() {
      expect(routerStub.patch
        .withArgs('/:id', 'flightCtrl.update')
        ).to.have.been.calledOnce;
    });

  });

  describe('DELETE /api/flights/:id', function() {

    it('should route to flight.controller.destroy', function() {
      expect(routerStub.delete
        .withArgs('/:id', 'flightCtrl.destroy')
        ).to.have.been.calledOnce;
    });

  });

});
