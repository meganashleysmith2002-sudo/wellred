!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','1451790383448139');
fbq('track','PageView');
document.addEventListener('click',function(e){var l=e.target&&e.target.closest?e.target.closest('a[href*="eventbrite.com"]'):null;if(!l||window.__wrLead||typeof fbq!=='function')return;window.__wrLead=1;setTimeout(function(){window.__wrLead=0},1500);fbq('track','Lead',{content_name:document.title,content_category:'Meetup RSVP',currency:'USD',value:0})},true);
