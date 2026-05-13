'use strict';

describe('Component: AdminGuestsComponent', function () {

  // load the controller's module
  beforeEach(module('goldPointsApp'));

  var AdminGuestsComponent;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($componentController) {
    AdminGuestsComponent = $componentController('adminGuests', {});
  }));

  it('should ...', function () {
    expect(1).to.equal(1);
  });
});
