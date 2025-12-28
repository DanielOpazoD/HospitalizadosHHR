import { formatDateDDMMYYYY } from '../services/utils/dateFormatter';

export const CENSUS_DEFAULT_RECIPIENTS = [
    'arenka.palma@hospitalhangaroa.cl',
    'natalia.arzola@hospitalhangaroa.cl',
    'vaitiare.hereveri@hospitalhangaroa.cl',
    'kaany.pakomio@hospitalhangaroa.cl',
    'claudia.salgado@hospitalhangaroa.cl',
    'andrea.saldana@saludoriente.cl',
    'bianca.atam@hospitalhangaroa.cl',
    'ana.pont@hospitalhangaroa.cl',
    'katherin.pont@hospitalhangaroa.cl',
    'eyleen.cisternas@hospitalhangaroa.cl',
    'marco.ramirez@hospitalhangaroa.cl',
    'josemiguel.villavicencio@hospitalhangaroa.cl',
    'patricio.medina@saludoriente.cl',
    'carla.curinao@hospitalhangaroa.cl',
    'epidemiologia@hospitalhangaroa.cl',
    'archivosome@hospitalhangaroa.cl',
    'antonio.espinoza@hospitalhangaroa.cl',
    'juan.pakomio@hospitalhangaroa.cl',
    'gestion.camas@saludoriente.cl',
    'ivan.pulgar@hospitalhangaroa.cl',
    'daniel.opazo@hospitalhangaroa.cl'
];

// Use simple hyphen to avoid encoding issues
export const buildCensusEmailSubject = (date: string) => `Censo diario pacientes hospitalizados - ${formatDateDDMMYYYY(date)}`;

/**
 * Builds the census email body in plain text format.
 */
export const buildCensusEmailBody = (date: string, nursesSignature?: string, encryptionPin?: string): string => {
    // Parse date to get day, month name, year
    const [year, month, day] = date.split('-');
    const monthNames = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const monthName = monthNames[parseInt(month, 10) - 1] || month;
    const dayNum = parseInt(day, 10);

    // Security note
    const securityNote = encryptionPin
        ? `\nClave Excel: ${encryptionPin}\n`
        : '';

    // Visual separator using Unicode horizontal lines
    const separator = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    // Nurse signature block
    const signatureBlock = nursesSignature
        ? `${separator}${nursesSignature}\nEnfermería - Servicio Hospitalizados\nHospital Hanga Roa\nAnexo MINSAL 328388`
        : `${separator}Enfermería - Servicio Hospitalizados\nHospital Hanga Roa\nAnexo MINSAL 328388`;

    return [
        'Estimados.',
        '',
        `Junto con saludar, envío adjunto planilla estadística de pacientes hospitalizados correspondiente al día ${dayNum} de ${monthName} de ${year}.`,
        securityNote,
        'Saludos cordiales',
        signatureBlock
    ].join('\n');
};
