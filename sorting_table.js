//
// new SortingTable( 'my_table', {
//   zebra: true,                        // Stripe the table, also on initialize
//   details: false,                     // Has details every other row
//   paginator: false,                   // Pass a paginator object
//   dont_sort_class: 'nosort',          // Class name on th's that don't sort
//   forward_sort_class: 'forward_sort', // Class applied to forward sort th's
//   reverse_sort_class: 'reverse_sort'  // Class applied to reverse sort th's
// });
//
// The above were the defaults.  The regexes in load_conversions test a cell
// begin sorted for a match, then use that conversion for all elements on that
// column.
//
// Requires mootools Class, Array, Function, Element, Element.Selectors,
// Element.Event, and you should probably get Window.DomReady if you're smart.
//

var SortingTable = new Class({

  initialize: function( table, options ) {
    this.options = $merge({
      zebra: true,
      details: false,
      paginator: false,
      dont_sort_class: 'nosort',
      forward_sort_class: 'forward_sort',
      reverse_sort_class: 'reverse_sort'
    }, options);
    
    this.table = $(table);
    this.tbody = $(this.table.getElementsByTagName('tbody')[0]);
    if (this.options.zebra) {
      SortingTable.stripe_table( this.tbody.getElementsByTagName( 'tr' ) );
    }

    this.headers = new Hash;
    var thead = $(this.table.getElementsByTagName('thead')[0]);
    this.headers = thead.getElementsByTagName('tr')[0].getElementsByTagName('th');
    $each(this.headers, function( header, index ) {
      var header = $(header);
      if (header.hasClass( this.options.dont_sort_class )) { return }
      header.store( 'column', index )
      header.addEvent( 'mousedown', function(evt){
        var evt = new Event(evt);
        this.sort_by_header( evt.target );
        if ( this.options.paginator) this.options.paginator.to_page( 1 );
      }.bind( this ) );
    }.bind( this ) );

    this.load_conversions();
  },

  sort_by_header: function( header ){
    this.rows = new Array;
    var trs = this.tbody.getElements( 'tr' );
    while ( row = trs.shift() ) {
      row = { row: row.dispose() };
      if ( this.options.details ) {
        row.detail = trs.shift().dispose();
      }
      this.rows.unshift( row );
    }
    
    if ( this.sort_column >= 0 &&
         this.sort_column == header.retrieve('column') ) {
      // They were pulled off in reverse
      if ( header.hasClass( this.options.reverse_sort_class ) ) {
        header.removeClass( this.options.reverse_sort_class );
        header.addClass( this.options.forward_sort_class );
      } else {
        header.removeClass( this.options.forward_sort_class );
        header.addClass( this.options.reverse_sort_class );
      }
    } else {
      $each(this.headers, function(h){
        h.removeClass( this.options.forward_sort_class );
        h.removeClass( this.options.reverse_sort_class );
      }.bind( this ));
      this.sort_column = header.retrieve('column');
      if (header.retrieve('conversion_function')) {
        this.conversion_matcher = header.retrieve('conversion_matcher');
        this.conversion_function = header.retrieve('conversion_function');
      } else {
        this.conversion_function = false;
        this.rows.some(function(row){
          var to_match = $(row.row.getElementsByTagName('td')[this.sort_column]).get('text');
          if (to_match == ''){ return false }
          this.conversions.some(function(conversion){
            if (conversion.matcher.test( to_match )){
              this.conversion_matcher = conversion.matcher;
              this.conversion_function = conversion.conversion_function;
              return true;
            }
            return false;
          }.bind( this ));
          if (this.conversion_function){ return true; }
          return false;
        }.bind( this ));
        header.store('conversion_function', this.conversion_function.bind( this ) );
        header.store('conversion_matcher', this.conversion_matcher );
      }
      header.addClass( this.options.forward_sort_class );
      this.rows.each(function(row){
        row.compare_value = this.conversion_function( row );
        row.toString = function(){ return this.compare_value }
      }.bind( this ));
      this.rows.sort();
    }

    var index = 0;
    while ( row = this.rows.shift() ) {
      row.row.injectInside( this.tbody );
      if (row.detail){ row.detail.injectInside( this.tbody ) };
      if ( this.options.zebra ) {
        row.row.className = row.row.className.replace( this.removeAltClassRe, '$1').clean();
        if (row.detail){
          row.detail.className = row.detail.className.replace( this.removeAltClassRe, '$1').clean();
        }
        if ( ( index % 2 ) == 0 ) {
          row.row.addClass( 'alt' );
          if (row.detail){ row.detail.addClass( 'alt' ); }
        }
      }
      index++;
    }
    this.rows = false;
  },

  load_conversions: function() {
    this.conversions = $A([
      // 1.75 MB, 301 GB, 34 KB, 8 TB
      { matcher: /([0-9.]{1,8}).*([KMGT]{1})B/,
        conversion_function: function( row ) {
          var cell = $(row.row.getElementsByTagName('td')[this.sort_column]).get('text');
          cell = this.conversion_matcher.exec( cell );
          if (!cell) { return '0' }
          if (cell[2] == 'M') {
            sort_val = '1';
          } else if (cell[2] == 'G') {
            sort_val = '2';
          } else if (cell[2] == 'T') {
            sort_val = '3';
          } else {
            sort_val = '0';
          }
          var i = cell[1].indexOf('.')
          if (i == -1) {
            post = '00'
          } else {
            var dec = cell[1].split('.');
            cell[1] = dec[0];
            post = dec[1].concat('00'.substr(0,2-dec[1].length));
          }
          return sort_val.concat('00000000'.substr(0,2-cell[1].length).concat(cell[1])).concat(post);
        }
      },
      // 1 day ago, 4 days ago, 38 years ago, 1 month ago
      { matcher: /(\d{1,2}) (.{3,6}) ago/,
        conversion_function: function( row ) {
          var cell = $(row.row.getElementsByTagName('td')[this.sort_column]).get('text');
          cell = this.conversion_matcher.exec( cell );
          if (!cell) { return '0' }
          var sort_val;
          if (cell[2].indexOf('month') != -1) {
            sort_val = '1';
          } else if (cell[2].indexOf('year') != -1) {
            sort_val = '2';
          } else {
            sort_val = '0';
          }
          return sort_val.concat('00'.substr(0,2-cell[1].length).concat(cell[1]));
        }
      },
      // Currency
      { matcher: /((\d{1}\.\d{2}|\d{2}\.\d{2}|\d{3}\.\d{2}|\d{4}\.\d{2}|\d{5}\.\d{2}|\d{6}\.\d{2}))/,
        conversion_function: function( row ) {
          var cell = $(row.row.getElementsByTagName('td')[this.sort_column]).get('text');
          cell = cell.replace(/[^\d]/g, "");
          return '00000000000000000000000000000000'.substr(0,32-cell.length).concat(cell);
        }
      },
      // YYYY-MM-DD, YYYY-m-d
      { matcher: /(\d{4})-(\d{1,2})-(\d{1,2})/,
        conversion_function: function( row ) {
          var cell = $(row.row.getElementsByTagName('td')[this.sort_column]).get('text');
          cell = this.conversion_matcher.exec( cell );
          return new Date(parseInt(cell[1]), parseInt(cell[2], 10) - 1, parseInt(cell[3], 10));
        }
      },
      // Numbers
      { matcher: /^\d+$/,
        conversion_function: function( row ) {
          var cell = $(row.row.getElementsByTagName('td')[this.sort_column]).get('text');
          return '00000000000000000000000000000000'.substr(0,32-cell.length).concat(cell);
        }
      },
      // Fallback 
      { matcher: /.*/,
        conversion_function: function( row ) {
          return $(row.row.getElementsByTagName('td')[this.sort_column]).get('text');
        }
      }
    ]);
  }

});

SortingTable.removeAltClassRe = new RegExp('(^|\\s)alt(?:\\s|$)');
SortingTable.implement({ removeAltClassRe: SortingTable.removeAltClassRe });

SortingTable.stripe_table = function ( tr_elements  ) {
  var counter = 0;
  $$( tr_elements ).each( function( tr ) {
    if ( !tr.hasClass('collapsed') ) {
      counter++;
    }
    tr.className = tr.className.replace( this.removeAltClassRe, '$1').clean();
    if ( !(( counter % 2 ) == 0) ) {
      tr.addClass( 'alt' );   
    }
  }.bind( this ));
}

