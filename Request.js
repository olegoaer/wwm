module.exports = function(){

  this._entireURL;
  this._metaMetaModel;
  this._metaModel;
  this._model;
  this._fragment;
  this._query;

  this.createRequest = function(stringURL, stringMetaMetaModel, stringMetaModel, stringModel, stringfragment, stringQuery){

    this._entireURL     = stringURL;
    this._metaMetaModel = stringMetaMetaModel;
    this._metaModel     = stringMetaModel;
    this._model         = stringModel;
    this._fragment      = stringfragment;
    this._query         = stringQuery;
  };

  this.isMetaMetaModel = function(){

    return ((this._metaMetaModel != null && this._metaModel == null && this._model == null) ? true : false);
  };

  this.isMetaModel = function(){

    return ((this._metaMetaModel != null && this._metaModel != null && this._model == null) ? true : false);
  };

  this.isModel = function(){

    return ((this._metaMetaModel != null && this._metaModel != null && this._model != null) ? true : false);
  };

  this.isFragment = function(){

    return ((this._fragment != null) ? true : false);
  };

  this.isQuery = function(){

    return ((this._query != null) ? true : false);
  };

  this.debug = function(){

    console.log(this._entireURL + ", " + this._metaMetaModel + ", " + this._metaModel + ", " + this._model + ", " + this._fragment + ", " + this._query);
  };
};
