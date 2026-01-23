import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Github,
  Linkedin,
  Globe,
  Twitter,
  MessageCircle,
  ArrowLeft,
  Star,
  Calendar,
  Users,
  Plus,
  Sparkles,
  Shield,
  Hammer,
  ExternalLink,
  MapPin
} from 'lucide-react'
import BottomNav from '../components/BottomNav'
import { getMyProjects, DEMO_CURRENT_USER_ID } from '../utils/projectData'
import { getUserProfile, LOOKING_FOR_LABELS, ACTIVITY_TYPES } from '../utils/mockProfileData'

/**
 * UserProfileScreen - Read.cv Inspired Editorial Profile
 * Minimalist, de-boxed design with editorial typography
 */

const CURRENT_USER_ID = 'current-user'

// Tool brand icons (simplified SVG paths)
const TOOL_ICONS = {
  'Figma': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"/>
      <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"/>
      <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"/>
      <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"/>
      <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"/>
    </svg>
  ),
  'React': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <circle cx="12" cy="12" r="2.5"/>
      <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)"/>
      <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)"/>
    </svg>
  ),
  'Node.js': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 1.85c-.27 0-.55.07-.78.2l-7.44 4.3c-.48.28-.78.8-.78 1.36v8.58c0 .56.3 1.08.78 1.36l1.95 1.12c.95.46 1.27.46 1.7.46 1.4 0 2.2-.85 2.2-2.33V8.44c0-.12-.1-.22-.22-.22H8.5c-.13 0-.23.1-.23.22v8.47c0 .66-.68 1.31-1.77.76L4.45 16.5a.26.26 0 0 1-.12-.22V7.72c0-.09.05-.17.13-.22l7.44-4.3a.26.26 0 0 1 .26 0l7.44 4.3c.08.05.13.13.13.22v8.56c0 .09-.05.17-.13.22l-7.44 4.3a.26.26 0 0 1-.26 0l-1.88-1.12a.2.2 0 0 0-.2-.01c-.65.38-.77.42-1.38.64-.15.05-.38.14.09.4l2.45 1.45c.24.14.5.21.78.21s.55-.07.78-.2l7.44-4.3c.48-.28.78-.8.78-1.36V7.7c0-.56-.3-1.08-.78-1.36l-7.44-4.3c-.23-.12-.5-.19-.78-.19z"/>
    </svg>
  ),
  'TypeScript': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/>
    </svg>
  ),
  'Python': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09z"/>
      <path d="M21.1 6.11l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01.21.03zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z"/>
    </svg>
  ),
  'PostgreSQL': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M17.128 0a10.134 10.134 0 0 0-2.755.403l-.063.02a10.922 10.922 0 0 0-1.612.49l-.04.014c-.9.32-1.74.74-2.46 1.27-.76-.19-1.57-.29-2.37-.29-1.94 0-3.73.59-4.86 1.73-.38.38-.69.83-.94 1.33-.9 1.83-.78 4.18.46 6.76 1.24 2.58 3.62 5.24 7.03 7.56l.06.04c.53.37 1.1.69 1.68.97.58.28 1.19.5 1.8.68h.02c1.32.38 2.65.56 3.85.56.82 0 1.58-.08 2.26-.24.94-.22 1.73-.59 2.33-1.15a4.1 4.1 0 0 0 .95-1.27c.2-.44.32-.92.36-1.44.05-.52.01-1.08-.1-1.69a9.815 9.815 0 0 0-.99-2.58c.57-.91.96-1.94 1.16-3.03.2-1.08.2-2.23-.02-3.4-.21-1.18-.66-2.4-1.36-3.55a10.9 10.9 0 0 0-2.17-2.44A10.3 10.3 0 0 0 17.13 0z"/>
    </svg>
  ),
  'Vercel': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M24 22.525H0l12-21.05 12 21.05z"/>
    </svg>
  ),
  'Supabase': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z"/>
    </svg>
  ),
  'VS Code': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
    </svg>
  ),
  'GitHub': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  ),
  'Docker': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.185-.186h-2.12a.186.186 0 0 0-.185.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
    </svg>
  ),
  'AWS': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.415-.287-.806-.407l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.27-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.385.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z"/>
    </svg>
  ),
  'Notion': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 2.033c-.42-.326-.98-.7-2.055-.607L3.01 2.648c-.466.046-.56.28-.374.466l1.823 1.094zm.793 3.172v13.851c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.166V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.98zm14.337.746c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.933-.234-1.494-.934l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.453-.233 4.763 7.28v-6.44l-1.215-.14c-.093-.513.28-.886.747-.932l3.226-.186zm-14.617-7c0-.746.607-.98 1.027-1.026l14.476-1.166c.84-.047 1.215.467 1.215 1.073v4.993c0 .467-.187.933-.793.98l-15.27.886c-.56.047-.654-.327-.654-.7v-5.04z"/>
    </svg>
  ),
  'Linear': (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M.585 15.272a1.17 1.17 0 0 1 0-1.656L8.728 5.472a1.17 1.17 0 0 1 1.656 0l5.688 5.688a1.17 1.17 0 0 1 0 1.656L7.928 20.96a1.17 1.17 0 0 1-1.656 0l-5.687-5.688Zm7.344-11.46a1.17 1.17 0 0 1 0-1.655l1.17-1.17a1.17 1.17 0 0 1 1.655 0l8.403 8.403a1.17 1.17 0 0 1 0 1.656l-8.403 8.403a1.17 1.17 0 0 1-1.656 0l-1.169-1.17a1.17 1.17 0 0 1 0-1.656l6.063-6.062-6.063-6.063Z"/>
    </svg>
  ),
}

function UserProfileScreen() {
  const navigate = useNavigate()
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState([])
  const [activeTab, setActiveTab] = useState('active')
  const [isDesktop, setIsDesktop] = useState(false)

  const isOwner = userId === CURRENT_USER_ID || userId === 'me'

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const userProfile = getUserProfile(userId)
    if (userProfile) {
      setProfile(userProfile)
    }

    if (userId === CURRENT_USER_ID || userId === 'me') {
      const allProjects = getMyProjects()
      const prioritized = allProjects.sort((a, b) => {
        const aIsOwner = a.isOwner || a.ownerId === DEMO_CURRENT_USER_ID ? 1 : 0
        const bIsOwner = b.isOwner || b.ownerId === DEMO_CURRENT_USER_ID ? 1 : 0
        if (bIsOwner !== aIsOwner) return bIsOwner - aIsOwner
        return (b.joined ? 1 : 0) - (a.joined ? 1 : 0)
      })
      setProjects(prioritized)
    } else if (userProfile?.projects) {
      setProjects(userProfile.projects.map(p => ({ ...p, title: p.name, id: p.id })))
    }
  }, [userId])

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Profile not found</p>
      </div>
    )
  }

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unnamed User'
  const activeProjects = projects.filter(p => p.joined || p.isActive)
  const pastProjects = projects.filter(p => !p.joined && !p.isActive)
  const displayProjects = activeTab === 'active' ? activeProjects : pastProjects
  const pinnedProject = profile.pinnedProjectId
    ? (profile.projects?.find(p => p.id === profile.pinnedProjectId) || projects.find(p => p.id === profile.pinnedProjectId))
    : null

  // Desktop Layout
  if (isDesktop) {
    return (
      <div className="min-h-full bg-[#FAFAFA] font-sans">
        {/* Minimal Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex gap-16">
            {/* Identity Pillar - Sticky Sidebar */}
            <aside className="w-72 flex-shrink-0">
              <div className="sticky top-24">
                <IdentityPillar
                  profile={profile}
                  fullName={fullName}
                  isOwner={isOwner}
                  navigate={navigate}
                />
              </div>
            </aside>

            {/* Content Stream */}
            <main className="flex-1 min-w-0">
              <ContentStream
                profile={profile}
                projects={displayProjects}
                pinnedProject={pinnedProject}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                activeCount={activeProjects.length}
                pastCount={pastProjects.length}
                navigate={navigate}
              />
            </main>
          </div>
        </div>
      </div>
    )
  }

  // Mobile Layout
  return (
    <div className="min-h-full bg-white font-sans">
      {/* Mobile Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 pt-12 px-5 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          {isOwner && (
            <button
              onClick={() => navigate('/profile/edit')}
              className="text-sm font-medium text-primary"
            >
              Edit
            </button>
          )}
        </div>
      </header>

      {/* Mobile Content */}
      <div className="px-5 pb-28">
        {/* Mobile Identity */}
        <MobileIdentity
          profile={profile}
          fullName={fullName}
          isOwner={isOwner}
          navigate={navigate}
        />

        {/* Content Stream */}
        <ContentStream
          profile={profile}
          projects={displayProjects}
          pinnedProject={pinnedProject}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeCount={activeProjects.length}
          pastCount={pastProjects.length}
          navigate={navigate}
          isMobile
        />
      </div>

      <BottomNav />
    </div>
  )
}

// =============================================
// IDENTITY PILLAR (Desktop Sidebar)
// =============================================

function IdentityPillar({ profile, fullName, isOwner, navigate }) {
  const stats = profile.stats || {}
  const badges = profile.badges || []

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gray-100 ring-1 ring-gray-200">
        {profile.avatar ? (
          <img src={profile.avatar} alt={fullName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">
            {profile.firstName?.[0]}{profile.lastName?.[0]}
          </div>
        )}
      </div>

      {/* Name & Username */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{fullName}</h1>
        <div className="flex items-center gap-2 mt-1">
          {profile.username && (
            <span className="text-gray-500">@{profile.username}</span>
          )}
          {profile.openToMessages && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Open to collaborate
            </span>
          )}
        </div>
      </div>

      {/* University */}
      {profile.university && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>
            {profile.university}
            {profile.graduationYear && ` '${String(profile.graduationYear).slice(-2)}`}
          </span>
          {profile.isVerified && (
            <Shield className="w-4 h-4 text-emerald-500" />
          )}
        </div>
      )}

      {/* Bio */}
      {profile.bio && (
        <p className="text-[15px] leading-relaxed text-gray-600">
          {profile.bio}
        </p>
      )}

      {/* Social Links */}
      <div className="flex items-center gap-3">
        {profile.links?.github && (
          <SocialLink href={profile.links.github} icon={<Github className="w-5 h-5" />} />
        )}
        {profile.links?.linkedin && (
          <SocialLink href={profile.links.linkedin} icon={<Linkedin className="w-5 h-5" />} />
        )}
        {profile.links?.portfolio && (
          <SocialLink href={profile.links.portfolio} icon={<Globe className="w-5 h-5" />} />
        )}
        {profile.links?.twitter && (
          <SocialLink href={profile.links.twitter} icon={<Twitter className="w-5 h-5" />} />
        )}
      </div>

      {/* Stats Strip */}
      <div className="text-sm text-gray-500">
        <span className="font-medium text-gray-900">{stats.projectsCreated || 0}</span> Created
        <span className="mx-2 text-gray-300">•</span>
        <span className="font-medium text-gray-900">{stats.projectsJoined || 0}</span> Joined
        <span className="mx-2 text-gray-300">•</span>
        <span className="font-medium text-gray-900">{stats.eventsAttended || 0}</span> Events
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex items-center gap-2">
          {badges.map(badge => (
            <div
              key={badge.id}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${badge.color}15` }}
              title={badge.name}
            >
              <BadgeIcon icon={badge.icon} color={badge.color} />
            </div>
          ))}
        </div>
      )}

      {/* Action Button */}
      {!isOwner ? (
        <button
          onClick={() => navigate(`/chat/${profile.id}`)}
          className="w-full py-3 px-4 bg-primary text-white font-medium rounded-xl hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Message
        </button>
      ) : (
        <button
          onClick={() => navigate('/profile/edit')}
          className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          Edit Profile
        </button>
      )}
    </div>
  )
}

// =============================================
// MOBILE IDENTITY
// =============================================

function MobileIdentity({ profile, fullName, isOwner, navigate }) {
  const stats = profile.stats || {}

  return (
    <div className="py-6">
      {/* Top Row: Avatar + Name */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 ring-1 ring-gray-200 flex-shrink-0">
          {profile.avatar ? (
            <img src={profile.avatar} alt={fullName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
              {profile.firstName?.[0]}{profile.lastName?.[0]}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">{fullName}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {profile.username && (
              <span className="text-sm text-gray-500">@{profile.username}</span>
            )}
            {profile.openToMessages && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Open
              </span>
            )}
          </div>
          {profile.university && (
            <p className="text-sm text-gray-500 mt-1">
              {profile.university}
              {profile.graduationYear && ` '${String(profile.graduationYear).slice(-2)}`}
            </p>
          )}
        </div>
      </div>

      {/* Social Links */}
      <div className="flex items-center gap-3 mt-4">
        {profile.links?.github && (
          <SocialLink href={profile.links.github} icon={<Github className="w-5 h-5" />} />
        )}
        {profile.links?.linkedin && (
          <SocialLink href={profile.links.linkedin} icon={<Linkedin className="w-5 h-5" />} />
        )}
        {profile.links?.portfolio && (
          <SocialLink href={profile.links.portfolio} icon={<Globe className="w-5 h-5" />} />
        )}
        {profile.links?.twitter && (
          <SocialLink href={profile.links.twitter} icon={<Twitter className="w-5 h-5" />} />
        )}
      </div>

      {/* Stats Strip */}
      <div className="text-sm text-gray-500 mt-4">
        <span className="font-medium text-gray-900">{stats.projectsCreated || 0}</span> Created
        <span className="mx-2 text-gray-300">•</span>
        <span className="font-medium text-gray-900">{stats.projectsJoined || 0}</span> Joined
        <span className="mx-2 text-gray-300">•</span>
        <span className="font-medium text-gray-900">{stats.eventsAttended || 0}</span> Events
      </div>

      {/* Message Button (non-owner) */}
      {!isOwner && (
        <button
          onClick={() => navigate(`/chat/${profile.id}`)}
          className="w-full mt-5 py-3 px-4 bg-primary text-white font-medium rounded-xl hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Message
        </button>
      )}
    </div>
  )
}

// =============================================
// CONTENT STREAM (Right Column)
// =============================================

function ContentStream({ profile, projects, pinnedProject, activeTab, setActiveTab, activeCount, pastCount, navigate, isMobile }) {
  return (
    <div className={isMobile ? 'space-y-8' : 'space-y-12'}>
      {/* About */}
      <AboutSection profile={profile} isMobile={isMobile} />

      {/* Tech Stack */}
      <StackSection profile={profile} isMobile={isMobile} />

      {/* Projects */}
      <ProjectsSection
        projects={projects}
        pinnedProject={pinnedProject}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCount={activeCount}
        pastCount={pastCount}
        navigate={navigate}
        pinnedProjectId={profile.pinnedProjectId}
        isMobile={isMobile}
      />

      {/* Activity */}
      <ActivitySection profile={profile} isMobile={isMobile} />
    </div>
  )
}

// =============================================
// ABOUT SECTION
// =============================================

function AboutSection({ profile, isMobile }) {
  if (!profile.bio && (!profile.lookingFor || profile.lookingFor.length === 0)) return null

  return (
    <section>
      <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg mb-3' : 'text-xl mb-4'}`}>
        About
      </h2>

      {/* Bio - Only shown on mobile (desktop has it in sidebar) */}
      {isMobile && profile.bio && (
        <p className="text-[15px] leading-relaxed text-gray-600 mb-4">
          {profile.bio}
        </p>
      )}

      {/* Looking For */}
      {profile.lookingFor && profile.lookingFor.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.lookingFor.map(id => {
            const item = LOOKING_FOR_LABELS[id]
            if (!item) return null
            return (
              <span
                key={id}
                className="px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-600"
              >
                {item.emoji} {item.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Major */}
      {profile.major && profile.major.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {profile.major.map(m => (
            <span
              key={m}
              className="px-3 py-1.5 bg-primary-light rounded-full text-sm font-medium text-primary"
            >
              {m}
            </span>
          ))}
        </div>
      )}

      <div className="border-b border-gray-100 mt-8" />
    </section>
  )
}

// =============================================
// STACK SECTION
// =============================================

function StackSection({ profile, isMobile }) {
  const hasSkills = profile.skills && profile.skills.length > 0
  const hasTools = profile.tools && profile.tools.length > 0

  if (!hasSkills && !hasTools) return null

  return (
    <section>
      <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg mb-3' : 'text-xl mb-4'}`}>
        Tech Stack
      </h2>

      {/* Tools with Icons */}
      {hasTools && (
        <div className="flex flex-wrap gap-3 mb-4">
          {profile.tools.map(tool => (
            <div
              key={tool}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              title={tool}
            >
              <span className="text-gray-700">
                {TOOL_ICONS[tool] || <div className="w-5 h-5 rounded bg-gray-300" />}
              </span>
              <span className="text-sm font-medium text-gray-700">{tool}</span>
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {hasSkills && (
        <div className="flex flex-wrap gap-2">
          {profile.skills.map(skill => (
            <span
              key={skill}
              className="px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-600"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="border-b border-gray-100 mt-8" />
    </section>
  )
}

// =============================================
// PROJECTS SECTION
// =============================================

function ProjectsSection({ projects, pinnedProject, activeTab, setActiveTab, activeCount, pastCount, navigate, pinnedProjectId, isMobile }) {
  const filteredProjects = projects.filter(p => p.id !== pinnedProjectId)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>
          Projects
        </h2>

        {/* Minimal Tab Toggle */}
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'past'
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Past ({pastCount})
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Pinned Project - Subtle highlight */}
        {pinnedProject && activeTab === 'active' && (
          <ProjectCard
            project={pinnedProject}
            navigate={navigate}
            isPinned
          />
        )}

        {/* Other Projects */}
        {filteredProjects.length > 0 ? (
          filteredProjects.map((proj, idx) => (
            <ProjectCard key={proj.id || idx} project={proj} navigate={navigate} />
          ))
        ) : (
          <div className="py-12 text-center text-gray-400">
            No {activeTab} projects
          </div>
        )}
      </div>

      <div className="border-b border-gray-100 mt-8" />
    </section>
  )
}

function ProjectCard({ project, navigate, isPinned }) {
  const isOwner = project.isOwner || project.ownerId === DEMO_CURRENT_USER_ID

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className={`group p-5 rounded-2xl cursor-pointer transition-all ${
        isPinned
          ? 'bg-primary-light border border-primary/10 hover:border-primary/20'
          : 'bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm'
      }`}
    >
      {/* Pinned Badge */}
      {isPinned && (
        <div className="flex items-center gap-1.5 text-primary text-xs font-medium mb-2">
          <Star className="w-3.5 h-3.5 fill-current" />
          Featured
        </div>
      )}

      {/* Title & Role */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
            {project.title || project.name}
          </h3>
          {project.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0 mt-1" />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 mt-3">
        {project.role && (
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {project.role}
          </span>
        )}
        {project.outcome && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
            {project.outcome}
          </span>
        )}
        {isOwner && (
          <span className="text-xs font-medium text-primary bg-primary-light px-2 py-1 rounded">
            Owner
          </span>
        )}
      </div>
    </div>
  )
}

// =============================================
// ACTIVITY SECTION
// =============================================

function ActivitySection({ profile, isMobile }) {
  if (!profile.activity || profile.activity.length === 0) return null

  return (
    <section>
      <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg mb-3' : 'text-xl mb-4'}`}>
        Recent Activity
      </h2>

      <div className="space-y-3">
        {profile.activity.slice(0, 4).map((activity, idx) => {
          const activityType = ACTIVITY_TYPES[activity.type] || {}
          return (
            <div key={activity.id || idx} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${activityType.color}15` }}
              >
                <ActivityIcon type={activity.type} color={activityType.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{activity.title}</p>
                <p className="text-xs text-gray-400">{activity.timestamp}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// =============================================
// HELPER COMPONENTS
// =============================================

function SocialLink({ href, icon }) {
  const url = href.startsWith('http') ? href : `https://${href}`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
    >
      {icon}
    </a>
  )
}

function ActivityIcon({ type, color }) {
  const iconClass = "w-4 h-4"
  switch (type) {
    case 'project_created':
      return <Plus className={iconClass} style={{ color }} />
    case 'project_joined':
      return <Users className={iconClass} style={{ color }} />
    case 'event_attended':
      return <Calendar className={iconClass} style={{ color }} />
    default:
      return <Sparkles className={iconClass} style={{ color }} />
  }
}

function BadgeIcon({ icon, color }) {
  const iconClass = "w-4 h-4"
  switch (icon) {
    case 'shield-check':
      return <Shield className={iconClass} style={{ color }} />
    case 'sparkles':
      return <Sparkles className={iconClass} style={{ color }} />
    case 'hammer':
      return <Hammer className={iconClass} style={{ color }} />
    default:
      return <Star className={iconClass} style={{ color }} />
  }
}

export default UserProfileScreen
