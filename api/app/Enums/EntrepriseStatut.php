<?php

namespace App\Enums;

enum EntrepriseStatut: string
{
    case EN_ATTENTE = 'en_attente';
    case VALIDEE = 'validee';
    case REJETEE = 'rejetee';
}