'use strict'
var helper = require('../helpers/util')
var mappingPreimages = require('./mappingPreimages')

 /**
   * easier access to the storage resolver
   * Basically one instance is created foreach execution step and foreach component that need it.
   * (TODO: one instance need to be shared over all the components)
   */
class StorageViewer {
  constructor (_context, _storageResolver, _traceManager) {
    this.context = _context
    this.storageResolver = _storageResolver
    this.initialMappingsLocationPromise = null
    this.currentMappingsLocationPromise = null
    _traceManager.accumulateStorageChanges(this.context.stepIndex, this.context.address, {}, (error, storageChanges) => {
      if (!error) {
        this.storageChanges = storageChanges
      } else {
        console.log(error)
      }
    })
  }

  /**
    * return the storage for the current context (address and vm trace index)
    * by default now returns the range 0 => 1000
    *
    * @param {Function} - callback - contains a map: [hashedKey] = {key, hashedKey, value}
    */
  storageRange (callback) {
    this.storageResolver.storageRange(this.context.tx, this.context.stepIndex, this.context.address, (error, storage) => {
      if (error) {
        callback(error)
      } else {
        callback(null, Object.assign({}, storage, this.storageChanges))
      }
    })
  }

  /**
    * return a slot value for the current context (address and vm trace index)
    * @param {String} - slot - slot key (not hashed key!)
    * @param {Function} - callback - {key, hashedKey, value} -
    */
  storageSlot (slot, callback) {
    var hashed = helper.sha3_256(slot)
    if (this.storageChanges[hashed]) {
      return callback(null, this.storageChanges[hashed])
    }
    this.storageResolver.storageSlot(hashed, this.context.tx, this.context.stepIndex, this.context.address, (error, storage) => {
      if (error) {
        callback(error)
      } else {
        callback(null, storage)
      }
    })
  }

  /**
    * return True if the storage at @arg address is complete
    *
    * @param {String} address  - contract address
    * @return {Bool} - return True if the storage at @arg address is complete
    */
  isComplete (address) {
    return this.storageResolver.isComplete(address)
  }

  /**
    * return all the possible mappings locations for the current context (cached) do not return state changes during the current transaction
    *
    * @param {Function} callback
    */
  async initialMappingsLocation () {
    if (!this.initialMappingsLocationPromise) {
      this.initialMappingsLocationPromise = new Promise((resolve, reject) => {
        this.storageResolver.initialPreimagesMappings(this.context.tx, this.context.stepIndex, this.context.address, (error, initialMappingsLocation) => {
          if (error) {
            reject(error)
          } else {
            resolve(initialMappingsLocation)
          }
        })
      })
    }
    return this.initialMappingsLocationPromise
  }

  /**
    * return all the possible mappings locations for the current context (cached) and current mapping slot. returns state changes during the current transaction
    *
    * @param {Function} callback
    */
  async mappingsLocation () {
    if (!this.currentMappingsLocationPromise) {
      this.currentMappingsLocationPromise = new Promise((resolve, reject) => {
        this.extractMappingsLocationChanges(this.storageChanges, (error, mappingsLocationChanges) => {
          if (error) {
            reject(error)
          } else {
            resolve(mappingsLocationChanges)
          }
        })
      })
    }
    return this.currentMappingsLocationPromise
  }

  /**
    * retrieve mapping location changes from the storage changes.
    *
    * @param {Function} callback
    */
  extractMappingsLocationChanges (storageChanges, callback) {
    if (this.mappingsLocationChanges) {
      return callback(null, this.mappingsLocationChanges)
    }
    mappingPreimages.decodeMappingsKeys(storageChanges, (error, mappings) => {
      if (!error) {
        this.mappingsLocationChanges = mappings
        return callback(null, this.mappingsLocationChanges)
      } else {
        callback(error)
      }
    })
  }
}

module.exports = StorageViewer